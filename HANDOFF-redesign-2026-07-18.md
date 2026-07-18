# Handoff — Redesign "Clinical Precision" (2026-07-18)

เอกสารสรุปสำหรับส่งต่อ (เช่น ทำงานต่อใน Codex) ว่า **แก้ไฟล์อะไรบ้าง เพราะอะไร** และ **ต้องทำอะไรต่อ**
โปรเจกต์: Dashboard ติดตามตัวชี้วัด — คณะบริหารสาธารณสุขส่วนหน้าประจำอำเภอมายอ (สธน.มายอ) กองสาธารณสุข อบจ.ปัตตานี

---

## 0. TL;DR

1. เปลี่ยนดีไซน์ Dashboard + หน้านำเสนอ จากสไตล์เก่า **"Warm Cartoon Neubrutalism"** → **"Clinical Precision"** (โทน tailwindcss.com แต่คงเอกลักษณ์สีเขียวสาธารณสุข)
2. เขียนหน้านำเสนอ (`presentation.html`) ใหม่ให้ **ดึงข้อมูลจริงเรียลไทม์จาก GAS API** (เดิมเป็นตัวเลข hardcode / demo)
3. **ไฟล์ที่ deploy จริงอยู่ใน `gas/`** (clasp `rootDir: gas`) — พอร์ตเข้าไปแล้ว แต่ **ยังไม่ได้ `clasp push`** และ **ยังไม่ได้เปิดเรนเดอร์จริงในเบราว์เซอร์**

---

## 1. โครงสร้างไฟล์ที่ต้องเข้าใจก่อน (สำคัญที่สุด)

| ตำแหน่ง | บทบาท | หมายเหตุ |
|---|---|---|
| `gas/index.html` | **Dashboard ที่ deploy จริง** (ผู้บริหารเปิด) | เสิร์ฟผ่าน GAS_URL |
| `gas/presentation.html` | **หน้านำเสนอที่ deploy จริง** | เสิร์ฟผ่าน `GAS_URL?page=slides` |
| `gas/Code.gs` | Apps Script backend + router | `?page=slides` → `presentation`, อื่น ๆ → `index` |
| `index.html` (root) | working copy ของ dashboard | ต้อง sync ให้ตรงกับ `gas/index.html` |
| `presentation.html` (root) | working copy ของเด็ค | ต้อง sync ให้ตรงกับ `gas/presentation.html` |
| `index-tailwind-preview.html` (root) | ไฟล์พรีวิวดีไซน์ (offline, mock) ที่ใช้ให้อนุมัติ | เก็บไว้อ้างอิง ไม่ได้ deploy |
| `_backups/` | สำเนาไฟล์เดิมก่อนแก้ | ย้ายออกจาก `gas/` แล้วเพื่อไม่ให้ถูก push |

**กฎเหล็ก:** `.clasp.json` → `"rootDir": "gas"` แปลว่า **`clasp push` อัปเฉพาะไฟล์ในโฟลเดอร์ `gas/`**
ดังนั้นถ้าแก้ไฟล์ root ต้อง **copy เข้า `gas/` ก่อน push** เสมอ ไม่งั้นของจริงไม่เปลี่ยน
ห้ามวางไฟล์ `*.backup*.html` ใน `gas/` (ไม่มี `.claspignore` → มันจะถูก push ขึ้นไปด้วย)

> หมายเหตุ: ก่อนแก้ `gas/index.html` เป็นเวอร์ชัน **เก่ากว่า** root อยู่แล้ว (badge ยังเขียน "ข้อมูลสมมติ Prototype", fetch แบบเก่าไม่มี retry) — การพอร์ต root → gas จึงเป็นการอัปเกรดทั้งดีไซน์และ logic ในคราวเดียว

---

## 2. เหตุผลของการเปลี่ยน (ทำไม)

- **โจทย์ผู้ใช้:** อยากได้ดีไซน์ใกล้เคียง tailwindcss.com และให้สอดคล้องกับงาน (ใช้สกิล gridgeist)
- **ข้อควรระวังที่ปรับให้เหมาะ:** Tailwind เป็นสไตล์ developer (เย็น เทคนิค mono/โค้ด) แต่ผู้ใช้จริงคือ **ผู้บริหาร/เจ้าหน้าที่ รพ.สต.** ไม่ใช่ dev
  → จึง **หยิบหลักการของ Tailwind** (ความคม พื้นที่ว่าง เส้นบาง กริดเงียบ scale ตัวอักษร) แต่ **ไม่หยิบ** ก้อนสีเย็น/mono เป็นแบรนด์/โค้ดเป็นพระเอก และ**คงสีเขียวสาธารณสุขเดิม**ไว้เพื่อความน่าเชื่อถือและความต่อเนื่องของแบรนด์
- ผู้ใช้เลือก 2 ข้อตัดสินใจไว้ชัด:
  1. ทิศทาง = **"Tailwind polish, keep health identity"**
  2. ส่งงาน = **ทำไฟล์พรีวิวแยกก่อน** แล้วค่อยพอร์ตเข้าหน้าจริง (ทำแล้ว: อนุมัติ → พอร์ต)
  3. หน้านำเสนอ = **เด็คสไลด์ดึงข้อมูลสด** (สไลด์เล่าเรื่อง static + สไลด์ตัวเลข/กราฟ live)

---

## 3. Design system: ก่อน → หลัง

| มิติ | เดิม (Warm Neubrutalism) | ใหม่ (Clinical Precision) |
|---|---|---|
| พื้นหลัง | ครีม `#F6EFDC` + จุด dotted | slate ขาวสว่าง `#F8FAFC` + กริดจาง เฉพาะ hero |
| เส้นขอบ | ดำหนา 2–3px | slate บาง 1px (`#E2E8F0`) |
| เงา | offset แข็ง `3–5px 0 #000` | นุ่มซ้อนชั้น (soft shadow) |
| มุมโค้ง | 22px (ใหญ่) | 8–16px |
| สีแบรนด์ | เขียว `#2F9E63` | emerald `#059669` (พัฒนาจากเดิมให้คมขึ้น) |
| ไฮไลต์ | บล็อกสีเหลือง | ขีดเส้นใต้ emerald จาง |
| ไอคอน tile | กล่องหมุน −4° | สี่เหลี่ยมมุมมน ไม่หมุน พื้น brand-50 |
| ตัวอักษร | IBM Plex Sans Thai | คงเดิม + tracking แน่นบนหัวข้อ + tabular-nums บนตัวเลข |
| สี "ข้อมูล" | น้ำเงินทึบ | sky `#0EA5E9` (ใช้เชิง semantic = สารสนเทศ) |
| สถานะ | เขียว/เหลือง/แดง neubrutalism | emerald / amber `#D97706` / rose `#E11D48` (soft bg + border) |

**Design tokens ใหม่** (นิยามเป็น CSS variables ใน `:root` — ชุดเดียวกันทั้ง dashboard และเด็ค):
`--page --surface --surface-2 --ink --ink-2 --muted --line --line-2` ·
`--brand-700/600/500/100/50` · `--sky-600/500/100` ·
`--ok/-bg/-line, --warn/-bg/-line, --bad/-bg/-line` ·
`--r-sm/r/r-lg/r-pill` · `--sh-xs/sm/md/lg` · `--font --mono`

เกณฑ์สถานะคงเดิม: **≥ 80% ถึงเป้า · 65–79.9% เฝ้าระวัง · < 65% ต้องเร่งติดตาม**

---

## 4. ไฟล์ที่แก้ (รายไฟล์ + เหตุผล)

### 4.1 `index.html` (root) และ `gas/index.html`  — เหมือนกันทุกไบต์
- **แก้:** เขียน `<style>` ใหม่ทั้งบล็อกเป็น Clinical Precision, ปรับ markup ส่วนหัว/หัวข้อ section (เพิ่ม eyebrow label, ไฮไลต์ hero, chip มี dot), เอา inline pastel bg ของ KPI tile ออกให้สม่ำเสมอ
- **คงไว้ 100% (ไม่แตะ logic):** `renderDashboard()`, ดึงข้อมูลสด `fetchLiveDashboard()` (retry 3 ครั้ง + AbortController timeout 15s), ฟอร์ม feedback (มี localStorage queue กันเน็ตหลุด), ฟอร์มผู้รับผิดชอบ (owner), ปุ่มสไลด์ `?page=slides`, `CONFIG.useLiveData = true`
- **เหตุผล:** เปลี่ยนเฉพาะ "ชั้นดีไซน์" เพื่อพอร์ตกลับง่ายและไม่เสี่ยงกระทบ backend ที่ทำงานอยู่

### 4.2 `presentation.html` (root) และ `gas/presentation.html` — เขียนใหม่ทั้งไฟล์
- **โครงเรื่อง 12 สไลด์คงเดิม** (ปก → ทำไม → โซลูชัน → KPI → 7 งาน → วัคซีน → มะเร็ง → รายหน่วย → feedback → สถาปัตยกรรม → roadmap → ขอมติ) เพราะเป็นลำดับ pitch ที่ดีอยู่แล้ว
- **เปลี่ยนหลัก:** สไลด์ 4–8 (KPI/7 งาน/วัคซีน/มะเร็ง/รายหน่วย) **render จากข้อมูลจริง** ผ่าน `renderDeck(DATA)` ที่ดึงจาก `GAS_URL?action=all` (ชุด API เดียวกับ dashboard) — เดิมเป็นตัวเลข hardcode/demo
- **กลไกความทนทาน:** boot ด้วย `renderDeck(MOCK_DATA)` (fallback) ก่อน → `fetchLive()` ดึงจริงมา render ทับ; ถ้าเชื่อมไม่ได้หลัง 3 ครั้ง ใช้ข้อมูลสำรอง + badge ⚠️
- **Charts (Chart.js):** เส้นวัคซีน = emerald, doughnut มะเร็ง = emerald/rose/amber/slate, bar รายหน่วย 13 แห่ง = สีตามสถานะ; มี `makeChart()` ที่ `destroy()` ก่อน render ซ้ำ (กัน canvas reuse error ตอน fallback→live)
- **ป้ายความจริง:** เอา "ข้อมูลสมมติเพื่อการนำเสนอ" ออก เปลี่ยนเป็น badge สถานะ (loading / 🔗 live / ⚠️ mock) + footer บอกแหล่งข้อมูล
- **ชื่อ รพ.สต. บนกราฟ:** ย่อด้วย `shortFac()` (ตัดรหัสนำหน้า + แทน "โรงพยาบาลส่งเสริมสุขภาพตำบล" → "รพ.สต.") ให้อ่านได้บนแกน y
- **คงไว้:** ปุ่ม nav, คีย์ลูกศร/Space/Home/End, ปุ่ม F เต็มจอ, progress bar, คลิกเลื่อนสไลด์ (ยกเว้นคลิกบน canvas/ลิงก์)

### 4.3 ไฟล์ประกอบ
- `index-tailwind-preview.html` — ไฟล์พรีวิว offline ที่ใช้ตอนขออนุมัติดีไซน์ (mock ล้วน, ฟอร์มจำลอง) เก็บไว้อ้างอิง
- `_backups/` — เก็บของเดิม: `index.backup-neubrutalism-*.html`, `presentation.backup-neubrutalism-*.html`, ฯลฯ
- `memory/` — บันทึกความจำโปรเจกต์ (deploy topology + design)

---

## 5. สถานะการตรวจสอบ (ตามจริง)

- ✅ ตรวจโค้ดแล้ว: ไม่มี token เก่าตกค้าง, backend anchors ครบ, canvas id ครบ, root == gas ทุกไบต์
- ❌ **ยังไม่ได้เปิดเรนเดอร์จริงในเบราว์เซอร์** — ยังไม่ยืนยันภาพจริง การตัดบรรทัดภาษาไทย สัดส่วนกราฟ
- ❌ **ยังไม่ได้ `clasp push`** — ของจริงบนเวทียังเป็นดีไซน์เก่าจนกว่าจะ push

---

## 6. สิ่งที่ต้องทำต่อ (TODO สำหรับ Codex/ผู้ทำต่อ)

1. **ดูภาพจริง:** เปิด `index.html` และ `presentation.html` ในเบราว์เซอร์ (เด็คจะลองดึงข้อมูลจริงทันที) ตรวจ:
   - น้ำหนักสีเขียว emerald `#059669` เทียบของเดิม `#2F9E63` (ปรับได้ที่ตัวแปร `--brand-600`)
   - กราฟรายหน่วย 13 แห่ง สูงพอ/ชื่อไม่ล้น
   - หัวข้อ hero/สไลด์ตัดบรรทัดสวยที่จอ 1280/1600 และมือถือ
2. **Deploy:** `clasp push` แล้วทดสอบ GAS_URL + ปุ่ม "เปิดสไลด์นำเสนอ" (badge ต้องเป็น 🔗 เขียว = ข้อมูลจริง)
3. **ถ้าแก้ต่อ:** แก้ root → copy เข้า `gas/` → `clasp push` (อย่าลืม sync)
4. **ค้างจากเนื้อหา (ไม่เกี่ยวดีไซน์):** ยังต้องยืนยันชื่อจริง 13 รพ.สต. (ตอนนี้เป็น placeholder), เกณฑ์สถานะ, และให้เจ้าของงานกรอกข้อมูลจริง (ตาม roadmap ระยะ 3)

---

## 7. คำสั่งอ้างอิง

```bash
# ดูภาพจริง (Windows / Git Bash)
start "" "index.html"
start "" "presentation.html"

# sync root -> gas ก่อน deploy
cp index.html gas/index.html
cp presentation.html gas/presentation.html

# deploy (ต้องล็อกอิน clasp ของเจ้าของโปรเจกต์)
clasp push
```

GAS_URL (ปัจจุบันฝังในโค้ด): `https://script.google.com/macros/s/AKfycbxDSzYCX7LAxVcKi8YECaOEI2-_Jqthlvzh-z_-sBZpo_2QM3Rhp-dvB6iaTYAJfqsJ/exec`
เปิดหน้านำเสนอ: ต่อท้าย `?page=slides`

---

## 8. งานต่อเนื่องที่ทำเสร็จแล้ว (Codex · 2026-07-18)

- ✅ เปิดตรวจเรนเดอร์จริงผ่าน local web server ที่ 390px, 1280px และ 1600px
- ✅ Dashboard และเด็คไม่มี horizontal overflow; hero, KPI และกราฟรายหน่วย 13 แห่งไม่ล้น
- ✅ ยืนยันทั้ง Dashboard และเด็คเชื่อม GAS API สำเร็จ (badge `🔗 ข้อมูลจริงจาก Google Sheets`) และไม่มี console error จากตัวแอป
- ✅ แก้ responsive ของแถบนำทางเด็คบนมือถือ: ตัวนับ `8 / 12` ไม่ตัดบรรทัด และ footer ไม่ทับ nav
- ✅ sync `index.html` / `presentation.html` กับไฟล์คู่ใน `gas/` ตรงกันทุกไบต์
- ✅ `clasp push` สำเร็จ 4 ไฟล์ และอัปเดต production deployment เดิมจากเวอร์ชัน `@4` → `@5`
- ✅ ตรวจ production response แล้วพบ design token ใหม่, live-data deck และ mobile nav fix ครบ

Production deployment ปัจจุบัน:
`AKfycbxDSzYCX7LAxVcKi8YECaOEI2-_Jqthlvzh-z_-sBZpo_2QM3Rhp-dvB6iaTYAJfqsJ @7`

### เพิ่มโหมดแยก 7 งาน

- เพิ่ม navigation ระดับ Dashboard: `ภาพรวม` + งานทั้ง 7 งาน โดยหน้าภาพรวมและลำดับ Landing เดิมยังอยู่ครบ
- การ์ดงานในหน้าภาพรวมมีปุ่ม `ดูรายละเอียดงาน` เพื่อเปิด workspace ของงานนั้น
- workspace รายงานแสดงความก้าวหน้า สถานะ รอบข้อมูล และตัวชี้วัด real-time จาก API ชุดเดียวกับหน้ารวม
- งานวัคซีนและงานมะเร็งแสดงตารางผลงานราย 13 รพ.สต. เพราะ backend มีข้อมูลระดับหน่วยแล้ว
- อีก 5 งานแสดงตัวชี้วัดภาพรวมพร้อมพื้นที่รองรับข้อมูลราย รพ.สต. เมื่อ backend เพิ่มข้อมูลในอนาคต
- รองรับ direct link รูปแบบ `?program=ncd`, `?program=mch`, `?program=ecd`, `?program=vaccine`, `?program=dental`, `?program=elderly`, `?program=cancer`
- mobile ใช้แถบโหมดเลื่อนแนวนอน ไม่มี horizontal overflow ของทั้งหน้า
- ชื่อหน่วยบริการในตารางย่ออัตโนมัติเฉพาะมือถือ เช่น `โรงพยาบาลส่งเสริมสุขภาพตำบลตรัง` → `รพ.สต.ตรัง`; desktop ยังคงชื่อเต็มและรหัสหน่วยบริการ โดยชื่อเต็มยังอยู่ใน tooltip/accessible label บนมือถือ
