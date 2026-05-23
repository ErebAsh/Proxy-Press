package com.proxypress.app;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Shader;
import android.view.View;

import java.util.ArrayList;
import java.util.List;

public class NativeSplashView extends View {
    private Paint ripplePaint;
    private Paint textPaint;
    private Paint linePaint;
    private long startTime;
    private List<Ripple> ripples = new ArrayList<>();
    private List<Line> lines = new ArrayList<>();
    private int primaryColor = Color.parseColor("#2563EB");
    private int bgColor = Color.parseColor("#000000");
    private String logoText = "Proxy-Press";

    public NativeSplashView(Context context) {
        super(context);
        loadThemeColors(context);
        init();
    }

    private void loadThemeColors(Context context) {
        try {
            android.content.SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            
            // Check for custom theme first (try both prefixed and non-prefixed)
            String customThemeJson = prefs.getString("proxy-press-custom-theme", null);
            if (customThemeJson == null) customThemeJson = prefs.getString("_cap_proxy-press-custom-theme", null);
            
            if (customThemeJson != null) {
                try {
                    java.util.regex.Matcher bgMatcher = java.util.regex.Pattern.compile("\"bg\":\"(#[A-Fa-f0-9]+)\"").matcher(customThemeJson);
                    if (bgMatcher.find()) bgColor = Color.parseColor(bgMatcher.group(1));
                    
                    java.util.regex.Matcher primaryMatcher = java.util.regex.Pattern.compile("\"primary\":\"(#[A-Fa-f0-9]+)\"").matcher(customThemeJson);
                    if (primaryMatcher.find()) primaryColor = Color.parseColor(primaryMatcher.group(1));
                } catch (Exception e) {
                    // Fallback to defaults on parsing error
                }
            } else {
                // Check for light/dark mode preference
                String themeMode = prefs.getString("proxy-press-theme", null);
                if (themeMode == null) themeMode = prefs.getString("_cap_proxy-press-theme", "system");
                
                boolean isDark;
                if ("system".equals(themeMode)) {
                    isDark = (context.getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES;
                } else {
                    isDark = "dark".equals(themeMode);
                }
                
                bgColor = isDark ? Color.parseColor("#000000") : Color.parseColor("#F8FAFC");
                primaryColor = isDark ? Color.parseColor("#3B82F6") : Color.parseColor("#2563EB");
            }
        } catch (Exception e) {
            // Fallback to system-based defaults if anything goes wrong
            boolean isDark = (context.getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES;
            bgColor = isDark ? Color.parseColor("#000000") : Color.parseColor("#F8FAFC");
        }
    }

    private void init() {
        ripplePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        ripplePaint.setStyle(Paint.Style.STROKE);
        ripplePaint.setStrokeWidth(18f); // Even bolder for high-impact visual

        textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        textPaint.setTextAlign(Paint.Align.CENTER);
        textPaint.setTextSize(110f);
        textPaint.setFakeBoldText(true);

        linePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        linePaint.setStrokeWidth(2f);

        startTime = System.currentTimeMillis();

        for (int i = 0; i < 4; i++) ripples.add(new Ripple(i * 750));
        for (int i = 0; i < 4; i++) lines.add(new Line(0.2f + (i * 0.2f), 4000 + (i * 1000), i * 500));
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        int width = getWidth();
        int height = getHeight();
        if (width <= 0 || height <= 0) { invalidate(); return; }

        long elapsed = System.currentTimeMillis() - startTime;
        canvas.drawColor(bgColor);

        int centerX = width / 2;
        int centerY = height / 2;

        // Add a gentle floating "bobbing" effect to the center (Vertical float)
        float floatOffset = (float) Math.sin(elapsed / 800.0) * 15f;

        // Draw Lines (Shimmering news lines)
        for (Line line : lines) {
            float progress = ((elapsed + line.delay) % line.duration) / (float) line.duration;
            float x = -width + (progress * width * 2);
            linePaint.setShader(new LinearGradient(x, 0, x + width, 0, new int[]{Color.TRANSPARENT, primaryColor, Color.TRANSPARENT}, new float[]{0f, 0.5f, 1f}, Shader.TileMode.CLAMP));
            linePaint.setAlpha(25);
            canvas.drawLine(0, height * line.yPos + floatOffset * 0.5f, width, height * line.yPos + floatOffset * 0.5f, linePaint);
        }

        // Draw Ripples (Breathing & Organic)
        ripplePaint.setColor(primaryColor);
        for (Ripple ripple : ripples) {
            float progress = ((elapsed + ripple.delay) % 3500) / 3500f;
            
            // Non-linear expansion for "floating" feel
            float curvedProgress = (float) Math.pow(progress, 0.7);
            float radius = 80 + (curvedProgress * Math.max(width, height) / 1.3f);
            
            // Fade-in and Fade-out curve
            float opacity = 0f;
            if (progress < 0.2f) opacity = progress / 0.2f;
            else opacity = 1f - ((progress - 0.2f) / 0.8f);
            
            ripplePaint.setAlpha((int) (255 * (0.12f * opacity)));
            canvas.drawCircle(centerX, centerY + floatOffset, radius, ripplePaint);
        }

        // Draw Logo (Bobbing Float)
        float logoProgress = Math.min(1f, elapsed / 1000f);
        textPaint.setAlpha((int) (255 * logoProgress));
        textPaint.setShader(new LinearGradient(centerX - 250, centerY + floatOffset, centerX + 250, centerY + floatOffset, new int[]{primaryColor, Color.parseColor("#8B5CF6")}, null, Shader.TileMode.CLAMP));
        canvas.drawText(logoText, centerX, centerY + 20 + floatOffset, textPaint);

        invalidate();
    }

    private static class Ripple { long delay; Ripple(long delay) { this.delay = delay; } }
    private static class Line { float yPos; long duration; long delay; Line(float yPos, long duration, long delay) { this.yPos = yPos; this.duration = duration; this.delay = delay; } }
}
