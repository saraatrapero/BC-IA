# Security Specification for Business Case AI Pro

## Data Invariants
1. A Business Case must belong to a valid authenticated user.
2. Only Admins can modify global costs (logistics, tax, etc.).
3. Agents can only see and modify their own business cases.
4. Logistics costs, production costs, and tax rates must be positive numbers.
5. Roles are either 'admin' or 'agent'.

## The "Dirty Dozen" Payloads
1. **Identity Spoofing**: Attempt to create a Business Case for another `userId`.
2. **Privilege Escalation**: Attempt to update own role to `admin` in `users` collection.
3. **Ghost Field**: Adding `isVerified: true` to a Business Case.
4. **ID Poisoning**: Creating a case with a 2MB string as ID.
5. **Cost Poisoning**: Admin updating `capilarCost` to a negative value or a non-number.
6. **Orphaned Write**: Creating a business case without a valid user profile.
7. **Bypassing Owner**: Authenticated User B trying to `get` Business Case of User A.
8. **Resource Exhaustion**: Sending a references array with 10,000 items (should have a limit).
9. **Timestamp Spoofing**: Sending a manual `createdAt` string instead of server timestamp.
10. **State Skipping**: (Not applicable here as there's no complex state machine, but maybe "immutable" fields).
11. **Blanket Read**: Trying to `list` all business cases without filters.
12. **Null Pointer**: Trying to update a non-existent document with a malformed payload.

## Test Runner (firestore.rules.test.ts)
I will implement this to verify the rules.
