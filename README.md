# Dashboard ติดตามตัวชี้วัดตามนโยบาย คณะบริหารสาธารณสุขส่วนหน้าประจำอำเภอมายอ กองสาธารณสุข อบจ.ปัตตานี (Prototype)

Prototype แบบ **static** ของ Executive Monitoring Dashboard สำหรับประธานคณะบริหารสาธารณสุขส่วนหน้าประจำอำเภอมายอ ใช้กำกับติดตามตัวชี้วัด 7 งานหลัก ครอบคลุม รพ.สต. ในสังกัด 13 แห่ง และใช้ประกอบการประชุมขออนุมัติพัฒนาระบบจริง

> ⚠️ **ข้อมูลทั้งหมดเป็นข้อมูลสมมติ (Mock Data)** จัดทำเพื่อการนำเสนอเท่านั้น
> ไม่มีข้อมูลผู้ป่วยรายบุคคล และชื่อ รพ.สต. เป็น placeholder ("รพ.สต. หน่วยบริการ 01–13") จนกว่าจะยืนยันชื่อจริง

## วิธีเปิดใช้งาน

**แบบออนไลน์ (แนะนำ — แชร์ลิงก์ให้ผู้เข้าร่วมประชุมได้เลย):**
เปิด URL ของ Web App (ค่า `Link webapp` ใน `ENV.txt`) ด้วย browser หรือมือถือ — หน้า dashboard
ถูก serve จาก Google Apps Script โดยตรง พร้อมข้อมูลจริงจาก Google Sheets

**แบบออฟไลน์:** ดับเบิลคลิกไฟล์ `index.html` เปิดด้วย browser (Chrome / Edge / Firefox) ได้ทันที
ไม่ต้องติดตั้งโปรแกรม ไม่ต้องรัน server — ถ้าออนไลน์จะดึงข้อมูลจริงให้เอง ถ้าออฟไลน์แสดง mock data

รองรับทั้งจอ desktop / projector และมือถือ (responsive)

## ขั้นตอนอัปเดตโค้ดขึ้น Apps Script (สำหรับผู้พัฒนา)

```bash
cp index.html gas/index.html                # sync หน้า dashboard
cp presentation.html gas/presentation.html  # sync สไลด์นำเสนอ
clasp push -f                               # push gas/ ขึ้นโปรเจกต์ Apps Script
clasp deploy -i <deploymentId> -d "คำอธิบาย"   # อัปเดต deployment เดิม (URL ไม่เปลี่ยน)
```

deploymentId ดูจาก `clasp deployments` (ตัวที่ตรงกับ URL ใน `ENV.txt`)

## ไฟล์สำคัญ

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | หน้า dashboard ทั้งหมด (HTML/CSS/vanilla JS ไฟล์เดียว) — แสดง mock data ที่ฝังไว้ทันที แล้วลองดึงข้อมูลจริงจาก GAS API อัตโนมัติ ถ้าสำเร็จ badge จะเปลี่ยนเป็น "🔗 ข้อมูลจริงจาก Google Sheets" |
| `presentation.html` | สไลด์นำเสนอ 12 แผ่น (HTML slide deck ธีมโมเดิร์น + กราฟ Chart.js) — เปิดไฟล์ตรง ๆ หรือออนไลน์ที่ `<URL ใน ENV.txt>?page=slides` · เลื่อนด้วยลูกศร/คลิก/ปุ่มล่างจอ |
| `data/sample-indicators.json` | Mock data โครงสร้างเดียวกับที่ฝังใน `index.html` — key (`facilities`, `programs`, `facilityProgress`, `monthlyProgress`, `cancerTracking`) ตรงกับที่ GAS API ตอบกลับ |
| `gas/Code.gs` | โค้ด Google Apps Script ฝั่ง backend — มี `setupSheets()` สร้างชีต 7 แท็บพร้อมข้อมูลตัวอย่าง และ `doGet()` ตอบ JSON ทุก endpoint |
| `docs/dashboard-plan.md` | แนวคิด dashboard, โครง Google Sheets, GAS API endpoint, แนวทาง deploy ผ่าน GitHub + Cloudflare Pages |
| `ENV.txt` | ค่าเชื่อมต่อจริง: Google Sheet ID, Apps Script ID, URL ของ Web App |
| `README.md` | ไฟล์นี้ |

## การเปิดใช้ข้อมูลจริง (Google Sheets + GAS)

สถานะปัจจุบัน: **โค้ด push ขึ้น Apps Script แล้ว** (ผ่าน clasp — ดู `.clasp.json`) และ deployment
ที่ตรงกับ URL ใน `ENV.txt` ถูกอัปเดตเป็น version ล่าสุดแล้ว

เหลือขั้นตอนเดียวที่ต้องทำในเบราว์เซอร์ (ครั้งเดียว): **อนุญาตสิทธิ์สคริปต์ + สร้างชีต**

1. เปิดโปรเจกต์: <https://script.google.com/d/1WDqgJXaeq3UeYwnzaFDUV97SRcoacxRSnHZbJ99uxjrkJ6JrslUGaXC-/edit>
2. เลือกฟังก์ชัน `setupSheets` แล้วกด **Run** → กดยอมรับสิทธิ์ (Authorize) เมื่อระบบถาม
   → ชีต `Facilities`, `ProgramOwners`, `MonthlySummary`, `FacilityProgress`, `VaccineMonthly`, `CancerTracking`, `AuditLog` จะถูกสร้างพร้อมข้อมูลตัวอย่าง
3. ทดสอบเปิด `<URL ใน ENV.txt>?action=all&year=2569&month=07` ต้องได้ JSON
4. เปิด `index.html` — badge จะเปลี่ยนเป็น "🔗 ข้อมูลจริงจาก Google Sheets" อัตโนมัติ
   (ถ้าดึงไม่ได้ เช่น ออฟไลน์ จะแสดง mock data แทนโดยไม่มี error)

> หมายเหตุ: ก่อนกดอนุญาตสิทธิ์ ทุก URL จะตอบ 403 "การเข้าถึงถูกปฏิเสธ" — เป็นพฤติกรรมปกติของ
> Web App ที่ยังไม่ได้รับ consent จากเจ้าของบัญชี

แก้ไขตัวเลขในชีต → dashboard อัปเดตตาม (มี cache ฝั่ง GAS ประมาณ 10 นาที)

## สิ่งที่อยู่บน Dashboard

- **KPI cards**: 7 งาน / 13 รพ.สต. / ความก้าวหน้าเฉลี่ย / จำนวนงานที่ต้องเร่งติดตาม
- **การ์ดสรุป 7 งาน**: NCDs, อนามัยแม่และเด็ก, เด็กปฐมวัย, วัคซีน, ทันตกรรม, ผู้สูงอายุ, มะเร็ง — พร้อมสถานะ 3 ระดับ (ถึงเป้า / เฝ้าระวัง / ต้องเร่งติดตาม)
- **งานวัคซีน**: กราฟแท่งความครอบคลุมสะสมรายเดือน (ต.ค. 68 – ก.ค. 69) + ยอดฉีดตามเกณฑ์ / ล่าช้า / ปฏิเสธ / คงค้าง
- **งานมะเร็งแบบละเอียด**: เป้าหมาย → ได้รับอุปกรณ์ → ผลปกติ / ผลผิดปกติ → วินิจฉัย/ส่งต่อ → รอผล/คงค้าง พร้อมตารางรายหน่วยบริการ
- **ตารางราย 13 รพ.สต.**: ผลงานวัคซีนและมะเร็ง เรียงตามความก้าวหน้ารวม
- **เส้นทางข้อมูล (Data Flow)**: แผนภาพ 4 ขั้น (เจ้าหน้าที่กรอก → Google Sheets → Apps Script API → Dashboard) พร้อมเดโม interactive — แก้ตัวเลขในชีตจำลอง (mock) กดปุ่ม "จำลองการไหลของข้อมูล" แล้วเห็นตัวเลขไหลจากชีต → JSON → การ์ด dashboard แบบเคลื่อนไหว ใช้สาธิตในที่ประชุมว่าระบบจริงทำงานอย่างไร (ส่วนนี้เป็น mock ล้วน ไม่กระทบข้อมูลจริง)
- **แบบฟอร์มรับฟังความคิดเห็น** (ท้ายหน้า): ให้ผู้เข้าร่วมประชุมเสนอข้อมูลที่อยากให้เพิ่ม / pain point / รูปแบบการแสดงผล — คำตอบถูกบันทึกเข้าชีต `Feedback` ใน Google Sheets โดยไม่ต้องล็อกอิน ถ้าส่งไม่สำเร็จ (เช่น ออฟไลน์) ระบบเก็บไว้ในเครื่องและส่งใหม่อัตโนมัติเมื่อเปิดหน้าอีกครั้ง — ดูรายการทั้งหมดได้ที่ชีต `Feedback` หรือ `<URL>?action=feedback`

## ระยะถัดไป

ดูรายละเอียดใน `docs/dashboard-plan.md` — สรุปคือ Google Sheets (7 ชีต) + Google Apps Script API + deploy ผ่าน GitHub + Cloudflare Pages โดยหน้าเว็บปัจจุบันออกแบบให้สลับจาก mock data เป็น API จริงได้โดยแก้โค้ดจุดเดียว
