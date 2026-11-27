# API Validation (Postman)

Validates the Supabase Auth and REST API: create, read, update, delete, Row Level Security and database triggers.

## Before you run
1. The app is connected to Supabase and `supabase/schema.sql` has been run.
2. Three accounts exist (register them in the app, then promote two of them as in the main README):
   - a **reporter**, a **technician**, and an **admin**.
3. "Confirm email" is off in Supabase (Authentication -> Providers -> Email), otherwise login requests fail.

## Import
1. Postman -> Import -> select both files in this folder:
   - `Facility Service Request System.postman_collection.json`
   - `FSRS - Supabase.postman_environment.json`
2. Select the environment **FSRS - Supabase** (top right) and fill in: `base_url`, `anon_key`, and the email and password of the three accounts.
   `base_url` and `anon_key` are in Supabase -> Project Settings -> API.

## Run
1. Right-click the collection -> **Run collection** (Collection Runner). Keep the folder order, because later requests reuse ids saved by earlier ones.
2. Click **Run**. Every request has automatic tests (the *Tests* tab).

## What is checked (7 folders, 35 requests)
| Folder | Checks |
|---|---|
| 1. Authentication | Login for 3 roles, wrong password rejected, anonymous user blocked |
| 2. Categories | Read for all, create/rename by admin only, duplicate name rejected |
| 3. Complaints: create and read | Ticket code generated, status starts as New, validation (CHECK), reporter sees only own rows, reporter cannot set status or priority |
| 4. Admin | Admin sees all, sets priority, assigns technician, cannot assign a non-technician |
| 5. Technician | Sees only assigned, can update status only, Resolved sets `resolved_at`, cannot go back to New |
| 6. History, profiles and security | Status timeline written by trigger, reporter cannot delete a resolved complaint or promote self to admin, profile visibility |
| 7. Cleanup | Removes the test complaint and category |

## Evidence for `API Validation Evidence.pdf/png`
- Screenshot the Collection Runner result page showing the number of **passed** tests (all green).
- Screenshot one request with its *Body* and the *Test Results* tab (for example "Reporter cannot change status").
- Optional: Runner -> **Export Results** and keep the JSON file.

If a test fails because Supabase returns a different but still correct code (for example 401 instead of 403), read the response body first. Only change the expected code in the *Tests* tab after you are sure the behavior is correct.
