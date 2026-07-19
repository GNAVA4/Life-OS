package com.lifeos.app;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Мост JS -> нативный виджет (session 023). Приложение зовёт WidgetBridge.update({done,total,date});
// пишем в SharedPreferences "life_os_widget" и сразу обновляем виджет на рабочем столе.
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        Integer done = call.getInt("done", 0);
        Integer total = call.getInt("total", 0);
        String date = call.getString("date", "");

        Context ctx = getContext();
        SharedPreferences sp = ctx.getSharedPreferences("life_os_widget", Context.MODE_PRIVATE);
        sp.edit()
          .putInt("done", done == null ? 0 : done)
          .putInt("total", total == null ? 0 : total)
          .putString("date", date == null ? "" : date)
          .apply();

        TodayWidget.updateAll(ctx);
        call.resolve();
    }
}
