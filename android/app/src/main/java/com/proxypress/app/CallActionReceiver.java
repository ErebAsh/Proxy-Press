package com.proxypress.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.app.NotificationManager;

public class CallActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        String callerId = intent.getStringExtra("callerId");

        // Cancel the calling notification
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.cancel(101);
        }

        if ("ACTION_DECLINE".equals(action)) {
            // Notify the caller that the call was rejected
            notifyCallerDecline(callerId);
        }
    }

    private void notifyCallerDecline(final String callerId) {
        if (callerId == null || callerId.isEmpty()) return;
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    java.net.URL url = new java.net.URL("https://proxy-press-omega.vercel.app/api/messages/call");
                    java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json; utf-8");
                    conn.setRequestProperty("Accept", "application/json");
                    conn.setDoOutput(true);

                    String jsonInputString = "{\"targetUserId\": \"" + callerId + "\", \"event\": \"call-rejected\"}";

                    try (java.io.OutputStream os = conn.getOutputStream()) {
                        byte[] input = jsonInputString.getBytes("utf-8");
                        os.write(input, 0, input.length);
                    }

                    int code = conn.getResponseCode();
                    android.util.Log.d("CallActionReceiver", "Decline call notification response code: " + code);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }).start();
    }
}
