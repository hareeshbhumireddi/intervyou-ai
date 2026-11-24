# Security Specification & Payload Audit

## 1. Data Invariants
1. **Strict PII & Account Ownership Isolation (`/users/{userId}`)**:
   - Every `/users/{userId}` document stores candidate PII (`email`, `mobile`, `address`, `dob`, `resumeText`, `avatarUrl`).
   - Only an email-verified Firebase user whose `request.auth.uid == userId` may `get`, `create`, or `update` their own profile.
   - `list` queries across `/users` are completely forbidden so no user can enumerate other candidates.
   - No client may self-assign privileged fields (`role`, `isAdmin`, or arbitrary ghost keys).
2. **Master Gate & Subcollection Isolation (`/users/{userId}/interviews`, `/users/{userId}/savedJobs`, `/users/{userId}/applications`)**:
   - Creating or mutating any child document requires the parent `/users/{userId}` document to exist via `exists(/databases/$(database)/documents/users/$(userId))`.
   - Every child document must carry an immutable `userId` strictly matching `request.auth.uid`.
   - All `allow list` rules explicitly enforce `resource.data.userId == request.auth.uid` (without `get()`/`exists()` inside list) alongside verified owner UID matching.
3. **Terminal State Locking (`interviews/{interviewId}`)**:
   - Once an interview reaches `status == 'completed'`, subsequent updates to overwrite answers, evaluations, status, or final scores are rejected.
4. **Volumetric Bounds & Temporal Integrity**:
   - Document IDs strictly validate against `^[a-zA-Z0-9_\-]+$` (`<= 128` chars).
   - Every string checks `.size() <= MAX` matching `firebase-blueprint.json` (`avatarUrl <= 250000`, `resumeText <= 40000`, `intentSummary <= 2000`).
   - All `createdAt` (immutable after create) and `updatedAt` timestamps must equal `request.time`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Unauthenticated Profile Read (`get /users/victimUid`)**: `auth = null` -> `PERMISSION_DENIED`.
2. **Unverified Email Write (`create /users/uid` with `email_verified = false`)**: Spoofed/unverified token -> `PERMISSION_DENIED`.
3. **Cross-User Profile Hijack (`get /users/otherUid` or `update /users/otherUid`)**: Valid user A targeting user B -> `PERMISSION_DENIED`.
4. **Users Collection Enumeration (`list /users`)**: Authenticated user scanning `/users` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection (`create /users/uid` with `isAdmin: true`)**: Extra key outside blueprint `hasOnly(...)` allowlist -> `PERMISSION_DENIED`.
6. **Oversized Avatar Resource Poisoning (`update /users/uid` with 300KB+ `avatarUrl`)**: Exceeds `avatarUrl.size() <= 250000` -> `PERMISSION_DENIED`.
7. **Malicious Path ID Poisoning (`create /users/uid/interviews/bad$id` or 200-char ID)**: Fails `isValidId(interviewId)` regex `^[a-zA-Z0-9_\-]+$` -> `PERMISSION_DENIED`.
8. **Orphaned Interview Without Parent Profile (`create /users/uid/interviews/int1` when `/users/uid` missing)**: Master Gate `exists(/users/uid)` fails -> `PERMISSION_DENIED`.
9. **Identity Spoofing in Child Record (`create /users/uidA/interviews/int1` with `userId: 'uidB'`)**: `incoming().userId == request.auth.uid` fails -> `PERMISSION_DENIED`.
10. **Tampering After Interview Completion (`update /users/uid/interviews/int1` when `status == 'completed'`)**: Terminal state lock rejects reopening or altering completed score -> `PERMISSION_DENIED`.
11. **Backdated / Forged Server Timestamp (`create /users/uid/savedJobs/job1` with `createdAt: new Date(0)`)**: `incoming().createdAt == request.time` fails -> `PERMISSION_DENIED`.
12. **Unscoped List / Wrong Owner List Query (`list /users/uidA/applications` without `where('userId', '==', uidA)`)**: Query Enforcer requires matching owner + `resource.data.userId == request.auth.uid` -> `PERMISSION_DENIED`.
