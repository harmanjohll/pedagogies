# Sharing work between teachers

Co-Cher has no server. Each teacher's work is kept on their own device. So
"sharing" today means a file changing hands, and "syncing" means a shared place
both teachers can reach. This note records what is built, what is planned, and
what each plan needs from the school.

## Built: plan A, a file passed on by Teams (every school)

- **Where:** Lessons, Send; and Classes, Handover. Button: Send by Teams.
- **What happens:** the teacher picks colleagues (from the school's staff list,
  or by typing an email), Co-Cher saves the file and opens a Teams chat with
  them, message already written. The teacher drags the file in and sends.
- **On phones and tablets:** "Share from this device" hands the file straight
  to Teams through the device's own share sheet, where the device allows it.
- **Why the drag step remains:** a web page cannot place a file in a Teams
  chat. Only a Microsoft app that the school's IT has approved can. That is
  plan B.
- **Code:** `js/v3/together.js` (`sendByTeams`). No account, no approval, no
  data leaves the device except the file the teacher sends.

Send files hold lessons, room layouts, entries and term goals: no student
data. Handover files hold student names and observations, so they stay inside
the school's own Teams or OneDrive.

## Planned: plan B, a shared folder in OneDrive or SharePoint (Beatty first)

Beatty staff sign in to Microsoft 365 as `name@btyss.moe.edu.sg`. With one
approval, Co-Cher could read and write a shared folder for them: a department
library everyone sees, with nothing to drag.

**Not built. Waiting on the principal's go ahead and on IT.** What it needs:

1. **An app registration in the Microsoft Entra tenant that holds the
   `btyss.moe.edu.sg` accounts.** Type: single page application.
   Redirect address: `https://harmanjohll.github.io/pedagogies/cocher3/`.
   This yields a client ID, which is not a secret and can sit in this repo.
2. **Permission, delegated (the app acts only as the signed in teacher):**
   the narrowest that works. In order of preference:
   - `Files.ReadWrite.AppFolder`: Co-Cher sees only its own folder in each
     teacher's OneDrive. Easiest to approve, but it is per teacher, so a shared
     library needs teachers to share that folder with each other.
   - `Sites.Selected` on one SharePoint site (say, "Co-Cher Beatty"): Co-Cher
     sees that one site and nothing else. Best fit for a department library.
   - `Files.ReadWrite`: all the teacher's files. Works, but asks for far more
     than needed. Avoid.
3. **Consent.** Whoever administers the tenant must grant it. For an MOE
   tenant that is likely not the school. **This is the open question to take
   to IT:** who can approve a single page app with `Sites.Selected` for one
   site, and what they need to see first.
4. **On Co-Cher's side:** Microsoft's sign in library (MSAL, PKCE flow, no
   secret in the browser), then Microsoft Graph calls to list, read and write
   files. Offered only when the signed in school is Beatty
   (`currentSchoolId() === 'bty'`).

**Design already decided, so the build is quick once approved**

- One folder per department, plus one for the whole school.
- Each shared item is one file, in the same formats plan A already uses
  (`cocher-send`, Department Pack). So anything shared by folder can also be
  shared by Teams, and the other way round.
- Taking something from the folder makes the teacher's own copy, as a draft
  that names its author. Nobody edits a colleague's original. This avoids two
  people overwriting each other, which is the hard part of any sync.
- Publishing again replaces only the teacher's own earlier file.
- **Student data:** lessons, layouts and goals may go in the shared folder.
  Student evidence (handover files) is a separate decision for the principal,
  since the folder is wider than one colleague. Default: not in the library.

**Questions for the principal before the build**

1. Per teacher app folder, or one SharePoint site? (Recommended: one site.)
2. Who creates the SharePoint site and decides who is a member?
3. May student evidence be shared through it, or lessons only?

## Other schools: Google Drive

The same idea, on Google: `backend/` holds an Apps Script that gives a school a
Drive folder Co-Cher can read (see `backend/README.md`). It is partly built and
each school must set it up for itself. Plan A works for them today.

## One rule that sharing must keep

Co-Cher 2 and Co-Cher 3 read the same saved work on a device. Shared files may
ADD lessons and goals to it; they must never rename or reshape what is saved.
See `js/version.js`.
