package com.lifeos.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

// Виджет рабочего стола «Задачи на сегодня» (session 023). Только просмотр + тап -> открыть приложение.
// Данные читаются из SharedPreferences "life_os_widget" (их пишет WidgetBridgePlugin из приложения).
public class TodayWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) render(context, mgr, id);
    }

    static void updateAll(Context context) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(context, TodayWidget.class));
        for (int id : ids) render(context, mgr, id);
    }

    static void render(Context context, AppWidgetManager mgr, int id) {
        SharedPreferences sp = context.getSharedPreferences("life_os_widget", Context.MODE_PRIVATE);
        int done = sp.getInt("done", 0);
        int total = sp.getInt("total", 0);
        String storedDate = sp.getString("date", "");
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());

        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_today);

        if (!today.equals(storedDate)) {
            // данные не за сегодня (приложение не открывали) — не показываем чужой день
            v.setTextViewText(R.id.widget_count, "—");
            v.setProgressBar(R.id.widget_progress, 1, 0, false);
            v.setTextViewText(R.id.widget_sub, "открой приложение");
        } else {
            v.setTextViewText(R.id.widget_count, done + " / " + total);
            v.setProgressBar(R.id.widget_progress, Math.max(total, 1), done, false);
            String sub;
            if (total == 0) sub = "нет задач на сегодня";
            else if (done >= total) sub = "всё выполнено 🎉";
            else sub = "выполнено сегодня";
            v.setTextViewText(R.id.widget_sub, sub);
        }

        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch != null) {
            PendingIntent pi = PendingIntent.getActivity(
                context, 0, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            v.setOnClickPendingIntent(R.id.widget_root, pi);
        }

        mgr.updateAppWidget(id, v);
    }
}
