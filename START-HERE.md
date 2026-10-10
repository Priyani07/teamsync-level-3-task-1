# Pari, TeamSync ko aise run karo

**Ye Task 01 ka full source project hai. Task 02 is ZIP mein nahi hai.**

1. ZIP extract karo.
2. Node.js 24 LTS install karo (agar pehle se hai to `node -v` se check karo).
3. Extracted `TeamSync` folder VS Code mein open karo.
4. Terminal → New Terminal mein ye commands ek-ek karke run karo:

```bash
npm ci
npm run setup
npm run build
npm start
```

5. Browser mein **http://localhost:3000** open karo.
6. **Create an account** se apna account banao.
7. Sidebar ke workspace box par click karo aur workspace create karo.
8. **New space** se shared document ya project board banao.
9. **Share** se editor invite link nikalo. Link incognito / another browser mein open karke doosra account banao. Dono mein same document open karo — typing live sync hogi.

**Offline demo:** Production version (port 3000) online open karo. Document khulne aur sync hone ke baad network off karo, edit karo, phir reconnect karo. Offline refresh ke liye service worker ko pehle install hone do. Naya account/workspace/document banane ke liye internet/network connection chahiye.

**UI files:** `src/style.css`, `src/main.js`.

**Submission:** GitHub par source push karo. `node_modules`, `data`, `.env` upload mat karna. `docs/TECHNICAL-POST.md` mein technical article aur LinkedIn draft hai. `docs/TESTING.md` mein demo recording steps hain.

**Verified:** Syntax check, production build, aur four automated tests pass. Browser offline storage/visual QA, PostgreSQL/Redis integration aur load tests apne PC/deployment par verify karna baaki hai. Scale-out design included hai; high-volume benchmark claim nahi kiya gaya.

Terminal close karne par local server band ho jayega. Dubara run karne ke liye same folder mein `npm start` karo. Saved data `data/teamsync.db` mein rahega — is folder ko delete mat karna.
