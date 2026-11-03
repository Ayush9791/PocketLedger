package expo.modules.smsinbox

import android.provider.Telephony
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SmsInboxModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PocketLedgerSmsInbox")
    AsyncFunction("readInbox") { daysBack: Int, maxMessages: Int ->
      val context = appContext.reactContext ?: throw Exception("Android context unavailable")
      val cutoff = System.currentTimeMillis() - daysBack.coerceIn(1, 365) * 24L * 60L * 60L * 1000L
      val result = mutableListOf<Map<String, Any?>>()
      val projection = arrayOf(Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE)
      val cursor = context.contentResolver.query(
        Telephony.Sms.Inbox.CONTENT_URI,
        projection,
        "${Telephony.Sms.DATE} >= ?",
        arrayOf(cutoff.toString()),
        "${Telephony.Sms.DATE} DESC"
      )
      cursor?.use {
        val addressIndex = it.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
        val bodyIndex = it.getColumnIndexOrThrow(Telephony.Sms.BODY)
        val dateIndex = it.getColumnIndexOrThrow(Telephony.Sms.DATE)
        var count = 0
        while (it.moveToNext() && count < maxMessages.coerceIn(1, 2000)) {
          result.add(mapOf(
            "address" to it.getString(addressIndex),
            "body" to it.getString(bodyIndex),
            "date" to it.getLong(dateIndex)
          ))
          count++
        }
      }
      result
    }
  }
}