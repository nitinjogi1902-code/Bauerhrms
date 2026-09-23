HRSYNC DATE FORMAT SYSTEM

Files:
1. Settings.jsx
2. dateUtils.js

1) Replace:
frontend/src/Settings.jsx
with the Settings.jsx in this package.

2) Copy:
dateUtils.js
to:
frontend/src/dateUtils.js

IMPORTANT:
The Settings page now stores:
bauerHrmsDateTimeSettings

Default:
Date = DD-MM-YYYY
Time = 12-hour

The global utility keeps database/localStorage values in ISO YYYY-MM-DD,
while display can be changed centrally.

For every module where you want the visible date input to obey the setting,
replace:
<input type="date" value={...} onChange={...} />

with:
<DateField value={...} onChange={...} />

and import:
import { DateField, formatDate } from "./dateUtils";

For read-only displayed dates, replace:
{someDate}

with:
{formatDate(someDate)}

This is intentional: browser-native <input type="date"> controls its own
visible UI format and cannot be forced reliably to DD-MM-YYYY by JavaScript.
DateField uses a text display controlled by HRSYNC plus a native calendar
picker, while keeping the saved value as YYYY-MM-DD.

Do NOT change existing database/storage date values to DD-MM-YYYY.
Only the display/input layer should change. This prevents payroll,
attendance, leave, age, service-year and date comparisons from breaking.
