package com.sic.invitechat.next;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * 把一段 UTF-8 文本保存成文件。
 *
 * 为什么需要：Capacitor 的 Android WebView 默认不处理 blob: URL 的下载，
 * 备份导出里的 a[download] 在真机上点了什么都不发生。这里用系统的
 * Intent.ACTION_CREATE_DOCUMENT 让用户选保存位置，然后用 ContentResolver
 * 写入——SAF 不需要任何存储权限，也不保留 Uri 的持久权限（一次写入就够）。
 *
 * ActivityResult 来自 androidx.activity.result，是 Capacitor 的传递依赖，
 * 没有新增任何依赖。
 *
 * 不在 logcat 里记录文本内容——备份里是加密后的 JSON，但也不该进系统日志。
 */
@CapacitorPlugin(name = "DocumentSave")
public class DocumentSavePlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        String fileName = call.getString("fileName", "backup.json");
        String mimeType = call.getString("mimeType", "application/json");
        String text = call.getString("text");
        if (text == null) {
            call.reject("没有要保存的内容");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        try {
            // 回调里再读一次 text：PluginCall 会被 Capacitor 保存到 Activity 返回后
            // 恢复，不在 Java 字段里长期持有大字符串。
            startActivityForResult(call, intent, "handleSaveResult");
        } catch (Exception e) {
            call.reject("无法打开系统保存对话框：" + safeMessage(e));
        }
    }

    @ActivityCallback
    private void handleSaveResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() == Activity.RESULT_CANCELED) {
            // 用户主动取消：不是错误，按正常结果返回
            JSObject ret = new JSObject();
            ret.put("saved", false);
            call.resolve(ret);
            return;
        }
        if (result.getResultCode() != Activity.RESULT_OK) {
            call.reject("保存被中断，请重试");
            return;
        }

        Intent data = result.getData();
        Uri uri = data != null ? data.getData() : null;
        if (uri == null) {
            call.reject("系统没有返回保存位置");
            return;
        }

        String text = call.getString("text");
        if (text == null) {
            call.reject("没有要保存的内容");
            return;
        }

        try (OutputStream os = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (os == null) {
                call.reject("无法打开保存位置");
                return;
            }
            os.write(text.getBytes(StandardCharsets.UTF_8));
            os.flush();
        } catch (Exception e) {
            call.reject("写入文件失败：" + safeMessage(e));
            return;
        }

        JSObject ret = new JSObject();
        ret.put("saved", true);
        ret.put("name", queryDisplayName(uri, call.getString("fileName", "backup.json")));
        call.resolve(ret);
    }

    /** 系统可能因为重名改过文件名，拿它返回的显示名；拿不到就用请求的文件名。 */
    private String queryDisplayName(Uri uri, String fallback) {
        try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (idx >= 0) {
                    String name = cursor.getString(idx);
                    if (name != null && !name.isEmpty()) return name;
                }
            }
        } catch (Exception ignored) {
            // 拿不到显示名不影响保存结果，用 fallback
        }
        return fallback;
    }

    private static String safeMessage(Exception e) {
        String m = e.getMessage();
        return m != null && !m.isEmpty() ? m : "未知错误";
    }
}
