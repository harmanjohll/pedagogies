# sources/

Drop the school's ORIGINAL documents here — the staff timetable (.xlsx, .pdf,
.csv), framework documents, the term calendar, whatever the school issued.

Nothing in this folder is served by the backend. It exists so that:

* the next person can see where `school.json` and `staff.json` came from, and
* a re-import is possible when the timetable changes next semester.

The in-app **School Setup** page reads these, converts them, and writes the two
compiled files one level up. You never hand-write JSON.
