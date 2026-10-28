package com.sic.invitechat.next;

import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.CancellationSignal;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 指纹/面部解锁。只做两件事：查硬件可用性，弹一次系统验证。
 * 不读取、不保存任何生物特征数据——验证成功等同于"输对了 PIN"，
 * 由 JS 层决定是否解锁，PIN 始终是唯一的后备方式。
 *
 * 用系统框架的 android.hardware.biometrics.*（API 28/29+），
 * 不引入 androidx.biometric。API < 29 一律视为不可用。
 */
@CapacitorPlugin(name = "Biometric")
public class BiometricPlugin extends Plugin {

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            result.put("available", false);
            result.put("reason", "api");
            call.resolve(result);
            return;
        }
        try {
            // Framework API (not androidx): the manager comes from the system service.
            BiometricManager manager = getActivity().getSystemService(BiometricManager.class);
            if (manager == null) {
                result.put("available", false);
                result.put("reason", "unavailable");
                call.resolve(result);
                return;
            }
            int status;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                int authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG
                        | BiometricManager.Authenticators.BIOMETRIC_WEAK;
                status = manager.canAuthenticate(authenticators);
            } else {
                // API 29：只有无参版本
                status = manager.canAuthenticate();
            }
            boolean available = status == BiometricManager.BIOMETRIC_SUCCESS;
            result.put("available", available);
            switch (status) {
                case BiometricManager.BIOMETRIC_SUCCESS:
                    result.put("reason", "ok");
                    break;
                case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED:
                    result.put("reason", "none_enrolled");
                    break;
                case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE:
                    result.put("reason", "no_hardware");
                    break;
                default:
                    result.put("reason", "unavailable");
                    break;
            }
            call.resolve(result);
        } catch (Exception e) {
            result.put("available", false);
            result.put("reason", "unavailable");
            call.resolve(result);
        }
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            JSObject result = new JSObject();
            result.put("ok", false);
            result.put("code", -1);
            result.put("message", "系统版本不支持指纹解锁");
            call.resolve(result);
            return;
        }

        String title = call.getString("title", "解锁");
        String subtitle = call.getString("subtitle", "");
        String cancelLabel = call.getString("cancelLabel", "取消");

        final AtomicBoolean resolved = new AtomicBoolean(false);

        try {
            getActivity().runOnUiThread(() -> {
                try {
                    CancellationSignal cancellationSignal = new CancellationSignal();
                    BiometricPrompt prompt = new BiometricPrompt.Builder(getActivity())
                            .setTitle(title)
                            .setSubtitle(subtitle)
                            // 用户点取消后，系统会回调 onAuthenticationError，不在这里 resolve，
                            // 避免二次 resolve
                            .setNegativeButton(cancelLabel, getActivity().getMainExecutor(), (dialog, which) -> {
                            })
                            .build();

                    prompt.authenticate(
                            cancellationSignal,
                            getActivity().getMainExecutor(),
                            new BiometricPrompt.AuthenticationCallback() {
                                @Override
                                public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                                    if (!resolved.compareAndSet(false, true)) return;
                                    JSObject res = new JSObject();
                                    res.put("ok", true);
                                    call.resolve(res);
                                }

                                @Override
                                public void onAuthenticationError(int errorCode, CharSequence errString) {
                                    if (!resolved.compareAndSet(false, true)) return;
                                    JSObject res = new JSObject();
                                    res.put("ok", false);
                                    res.put("code", errorCode);
                                    res.put("message", errString != null ? errString.toString() : "");
                                    call.resolve(res);
                                }

                                @Override
                                public void onAuthenticationFailed() {
                                    // 单次不匹配——系统会继续等待下一次尝试，这里不 resolve
                                }
                            }
                    );
                } catch (Exception e) {
                    if (!resolved.compareAndSet(false, true)) return;
                    JSObject res = new JSObject();
                    res.put("ok", false);
                    res.put("code", -3);
                    res.put("message", e.getMessage() != null ? e.getMessage() : "启动生物识别失败");
                    call.resolve(res);
                }
            });
        } catch (Exception e) {
            if (!resolved.compareAndSet(false, true)) return;
            JSObject res = new JSObject();
            res.put("ok", false);
            res.put("code", -3);
            res.put("message", e.getMessage() != null ? e.getMessage() : "启动生物识别失败");
            call.resolve(res);
        }
    }
}
