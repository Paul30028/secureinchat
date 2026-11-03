package com.sic.invitechat.next;

import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import androidx.annotation.RequiresApi;

import java.security.KeyStore;

import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;

/**
 * C10-A：用 Android Keystore 里的硬件密钥包裹本机主密钥。
 *
 * 硬件密钥是 AES-256-GCM，不可导出：密钥材料留在 StrongBox（独立安全芯片）或
 * TEE 里，本应用只能请系统用它加密/解密。StrongBox 优先，设备没有或生成失败时
 * 回退 TEE；实际级别从 KeyInfo 读出来如实返回，界面据此说明保护程度。
 *
 * M1 不绑定用户认证（setUserAuthenticationRequired 保持默认 false）：
 * 防的是「拷走应用数据目录后离线解密」，不防「已解锁设备上以本应用身份调用 Keystore」。
 * 也不随新录指纹失效。
 *
 * 只在内存里经手主密钥的原始字节，用完清零；不写 logcat。
 */
@CapacitorPlugin(name = "HardwareKeystore")
public class KeystorePlugin extends Plugin {

    private static final String PROVIDER = "AndroidKeyStore";
    private static final String ALIAS = "secureinchat-master-wrap-v1";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;

    @PluginMethod
    public void ensureKey(PluginCall call) {
        try {
            SecretKey key = loadKey();
            if (key == null) key = generateKey();
            JSObject ret = new JSObject();
            ret.put("level", levelOf(key));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("无法使用系统密钥库：" + safeMessage(e), "KEYSTORE_ERROR");
        }
    }

    @PluginMethod
    public void wrap(PluginCall call) {
        byte[] raw = null;
        try {
            raw = decode(call.getString("data"));
            byte[] aad = decode(call.getString("aad"));
            SecretKey key = loadKey();
            if (key == null) {
                call.reject("硬件密钥不存在", "KEY_MISSING");
                return;
            }
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            // IV 由 Keystore 随机生成（randomized encryption 必须开启，不允许调用方指定 IV）
            cipher.init(Cipher.ENCRYPT_MODE, key);
            cipher.updateAAD(aad);
            byte[] ct = cipher.doFinal(raw);
            byte[] iv = cipher.getIV();
            byte[] out = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(ct, 0, out, iv.length, ct.length);
            JSObject ret = new JSObject();
            ret.put("data", Base64.encodeToString(out, Base64.NO_WRAP));
            call.resolve(ret);
        } catch (KeyPermanentlyInvalidatedException e) {
            call.reject("硬件密钥已失效", "KEY_INVALIDATED");
        } catch (Exception e) {
            call.reject("包裹主密钥失败：" + safeMessage(e), "KEYSTORE_ERROR");
        } finally {
            if (raw != null) java.util.Arrays.fill(raw, (byte) 0);
        }
    }

    @PluginMethod
    public void unwrap(PluginCall call) {
        try {
            byte[] packed = decode(call.getString("data"));
            byte[] aad = decode(call.getString("aad"));
            if (packed.length <= IV_BYTES) {
                call.reject("主密钥记录太短", "UNWRAP_FAILED");
                return;
            }
            SecretKey key = loadKey();
            if (key == null) {
                call.reject("硬件密钥不存在（可能是清除数据、重装，或数据从别的设备恢复过来）", "KEY_MISSING");
                return;
            }
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, packed, 0, IV_BYTES));
            cipher.updateAAD(aad);
            byte[] raw = cipher.doFinal(packed, IV_BYTES, packed.length - IV_BYTES);
            JSObject ret = new JSObject();
            ret.put("data", Base64.encodeToString(raw, Base64.NO_WRAP));
            java.util.Arrays.fill(raw, (byte) 0);
            call.resolve(ret);
        } catch (KeyPermanentlyInvalidatedException e) {
            call.reject("硬件密钥已失效", "KEY_INVALIDATED");
        } catch (AEADBadTagException e) {
            call.reject("主密钥记录和硬件密钥不匹配", "UNWRAP_FAILED");
        } catch (Exception e) {
            call.reject("解包主密钥失败：" + safeMessage(e), "KEYSTORE_ERROR");
        }
    }

    @PluginMethod
    public void deleteKey(PluginCall call) {
        try {
            KeyStore ks = KeyStore.getInstance(PROVIDER);
            ks.load(null);
            if (ks.containsAlias(ALIAS)) ks.deleteEntry(ALIAS);
            call.resolve();
        } catch (Exception e) {
            call.reject("删除硬件密钥失败：" + safeMessage(e), "KEYSTORE_ERROR");
        }
    }

    private SecretKey loadKey() throws Exception {
        KeyStore ks = KeyStore.getInstance(PROVIDER);
        ks.load(null);
        KeyStore.Entry entry = ks.getEntry(ALIAS, null);
        if (entry instanceof KeyStore.SecretKeyEntry) {
            return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
        }
        return null;
    }

    private SecretKey generateKey() throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                return generateStrongBoxKey();
            } catch (Exception e) {
                // 没有 StrongBox（StrongBoxUnavailableException），或它的实现有问题、
                // 密钥数量受限：回退 TEE
            }
        }
        return generateKey(false);
    }

    @RequiresApi(Build.VERSION_CODES.P)
    private SecretKey generateStrongBoxKey() throws Exception {
        return generateKey(true);
    }

    private SecretKey generateKey(boolean strongBox) throws Exception {
        KeyGenParameterSpec.Builder b = new KeyGenParameterSpec.Builder(
                ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setRandomizedEncryptionRequired(true);
        if (strongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            b.setIsStrongBoxBacked(true);
        }
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, PROVIDER);
        kg.init(b.build());
        return kg.generateKey();
    }

    /** "strongbox" | "tee" | "software"：读系统报告的实际级别，不按请求猜。 */
    @SuppressWarnings("deprecation")
    private String levelOf(SecretKey key) {
        try {
            SecretKeyFactory f = SecretKeyFactory.getInstance(key.getAlgorithm(), PROVIDER);
            KeyInfo info = (KeyInfo) f.getKeySpec(key, KeyInfo.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                int level = info.getSecurityLevel();
                if (level == KeyProperties.SECURITY_LEVEL_STRONGBOX) return "strongbox";
                if (level == KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT) return "tee";
                if (level == KeyProperties.SECURITY_LEVEL_UNKNOWN_SECURE) return "tee";
                return "software";
            }
            // API 31 以下 KeyInfo 分不出 StrongBox 和 TEE，只说「在安全硬件里」
            return info.isInsideSecureHardware() ? "tee" : "software";
        } catch (Exception e) {
            return "software";
        }
    }

    private static byte[] decode(String b64) {
        if (b64 == null) throw new IllegalArgumentException("缺少参数");
        return Base64.decode(b64, Base64.NO_WRAP);
    }

    private static String safeMessage(Exception e) {
        String m = e.getMessage();
        return m == null ? e.getClass().getSimpleName() : m;
    }
}
