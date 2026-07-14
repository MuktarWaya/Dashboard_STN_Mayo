# แผนพัฒนา Dashboard ติดตามตัวชี้วัดตามนโยบาย คณะบริหารสาธารณสุขส่วนหน้าประจำอำเภอมายอ กองสาธารณสุข อบจ.ปัตตานี

> เอกสารประกอบการขออนุมัติพัฒนาระบบ — สถานะปัจจุบันเป็น **Prototype (ข้อมูลสมมติทั้งหมด)**

## 1. แนวคิดของ Dashboard

Dashboard นี้ออกแบบเป็น **Executive Monitoring Dashboard** สำหรับประธานคณะบริหารสาธารณสุขส่วนหน้าประจำอำเภอมายอ ใช้กำกับติดตาม รพ.สต. ในสังกัด 13 แห่ง และใช้เปิดนำเสนอในเวทีระดับจังหวัด โดยตอบคำถามผู้บริหารได้ภายในหน้าเดียว:

1. **ตอนนี้แต่ละงานคืบหน้ากี่เปอร์เซ็นต์** → การ์ดสรุป 7 งาน พร้อม progress bar
2. **งานไหนถึงเป้า / เฝ้าระวัง / ต้องเร่งติดตาม** → ระบบสถานะ 3 ระดับ (สัญญาณไฟ)
3. **แต่ละ รพ.สต. มีผลงานวัคซีนและมะเร็งอย่างไร** → ตารางราย 13 หน่วยบริการ เรียงตามความก้าวหน้า
4. **งานวัคซีนมีแนวโน้มรายเดือนดีขึ้นหรือไม่** → กราฟแท่งความครอบคลุมสะสมรายเดือน
5. **งานมะเร็งมีเป้าหมาย อุปกรณ์ ผลตรวจ การส่งต่อครบหรือไม่** → section งานมะเร็งแบบละเอียด (cascade 6 ขั้น + ตารางรายหน่วย)

### เกณฑ์สถานะ (ปรับได้ตามมติที่ประชุม)

| สถานะ | เกณฑ์ | สี |
|---|---|---|
| ถึงเป้า | ความก้าวหน้า ≥ 80% | เขียว |
| เฝ้าระวัง | 65 – 79.9% | เหลือง/ส้ม |
| ต้องเร่งติดตาม | < 65% | แดง |

### ตัวชี้วัด 7 งานที่ติดตาม

| # | งาน | ตัวชี้วัดย่อย |
|---|---|---|
| 1 | โรคไม่ติดต่อเรื้อรัง (NCDs) | กลุ่มสงสัยป่วย, การตรวจซ้ำ, คงค้าง |
| 2 | อนามัยแม่และเด็ก | เป้าหมาย, ดำเนินการแล้ว, คงค้าง |
| 3 | เด็กปฐมวัย | เป้าหมาย, คัดกรอง, ติดตามต่อ, คงค้าง |
| 4 | วัคซีน | เป้าหมายเด็ก 0-5 ปี, ฉีดตามเกณฑ์, ล่าช้า, ปฏิเสธ, ไม่ทราบสถานะ/คงค้าง + ผลรายเดือน |
| 5 | ทันตกรรม | เป้าหมาย, รับบริการแล้ว, คงค้าง |
| 6 | ผู้สูงอายุ | เป้าหมาย, คัดกรอง, ติดตามต่อ, คงค้าง |
| 7 | มะเร็ง | เป้าหมายทั้งหมด, ได้รับอุปกรณ์, ผลตรวจปกติ, ผลตรวจผิดปกติ, วินิจฉัย/ส่งต่อ, รอผล/คงค้าง |

### หลักการข้อมูล

- แสดงเฉพาะ **ข้อมูลเชิงสรุป (aggregate)** ระดับหน่วยบริการ/อำเภอ — **ไม่มีข้อมูลผู้ป่วยรายบุคคล** บนหน้า dashboard
- ชื่อ รพ.สต. ในระยะ prototype ใช้ placeholder "รพ.สต. หน่วยบริการ 01–13" จนกว่าจะยืนยันชื่อจริง

## 2. โครงสร้าง Google Sheets (ระยะ production)

ใช้ Google Sheets เป็นฐานข้อมูล ให้เจ้าของงาน/รพ.สต. กรอกข้อมูลสรุปรายเดือน โดยมีชีตดังนี้:

| ชีต | หน้าที่ | คอลัมน์หลัก (ตัวอย่าง) |
|---|---|---|
| `Facilities` | ทะเบียน รพ.สต. 13 แห่ง | facility_id, facility_name, subdistrict, active |
| `ProgramOwners` | ผู้รับผิดชอบแต่ละงาน | program_id, program_name, owner_name, phone, update_frequency |
| `MonthlySummary` | ยอดสรุปรายงาน/รายเดือน ระดับอำเภอ (7 งาน) | year, month, program_id, metric_key, value |
| `FacilityProgress` | ผลงานรายหน่วยบริการ/รายเดือน | year, month, facility_id, program_id, target, done, pending |
| `VaccineMonthly` | ผลงานวัคซีนรายเดือน (สะสม/รายเดือน) | year, month, facility_id, target, on_schedule, delayed, refused, unknown_pending |
| `CancerTracking` | การติดตามงานมะเร็งรายหน่วย | year, month, facility_id, target, kits_received, result_normal, result_abnormal, diagnosed_referred, pending_result |
| `AuditLog` | บันทึกการแก้ไขข้อมูล (ใคร แก้อะไร เมื่อไหร่) | timestamp, user_email, sheet, row_ref, action, old_value, new_value |

หมายเหตุการออกแบบ:
- ทุกชีตอ้างอิง `facility_id` (F01–F13) และ `program_id` (ncd, mch, ecd, vaccine, dental, elderly, cancer) เป็น key เดียวกับ JSON ของ prototype ทำให้สลับจาก mock data เป็นข้อมูลจริงได้โดยไม่แก้หน้าเว็บ
- ใช้ปี **พ.ศ. / ปีงบประมาณ** (เช่น 2569) ให้ตรงกับรอบรายงานราชการ
- `AuditLog` เขียนอัตโนมัติผ่าน GAS (onEdit trigger) เพื่อความโปร่งใสของข้อมูลก่อนนำเสนอจังหวัด

## 3. Google Apps Script (GAS) API

> สถานะ: มี Web App deploy แล้ว (URL ตาม `ENV.txt`) และเตรียมโค้ดพร้อมวางไว้ที่ `gas/Code.gs`
> — วางโค้ด → รัน `setupSheets` หนึ่งครั้ง → deploy new version

GAS ทำหน้าที่เป็น Web App (`/exec`) อ่านข้อมูลจากชีตแล้วตอบเป็น JSON โครงสร้างเดียวกับ `data/sample-indicators.json`:

| Endpoint | หน้าที่ |
|---|---|
| `GET /exec?action=all&year=2569&month=07` | ข้อมูลครบทุก section ในคำขอเดียว (หน้า dashboard ใช้ตัวนี้) |
| `GET /exec?action=summary&year=2569&month=07` | ยอดสรุป 7 งาน + KPI ภาพรวม |
| `GET /exec?action=facility-progress&year=2569&month=07` | ผลงานราย 13 รพ.สต. |
| `GET /exec?action=program&id=vaccine&year=2569` | รายละเอียดงานวัคซีน + ผลรายเดือนทั้งปี |
| `GET /exec?action=program&id=cancer&year=2569&month=07` | รายละเอียดงานมะเร็ง รายอำเภอ + รายหน่วย |

ฝั่งหน้าเว็บเชื่อมต่อแล้วใน `index.html` (ค่า `CONFIG.GAS_URL`) โดยใช้กลยุทธ์ **mock-first**:
แสดง mock data ทันทีเพื่อให้เปิดไฟล์ได้เสมอแม้ออฟไลน์ แล้วดึงข้อมูลจริงมา render ทับเมื่อสำเร็จ
พร้อมเปลี่ยน badge เป็น "🔗 ข้อมูลจริงจาก Google Sheets"

ข้อกำหนด GAS:
- ตอบ `ContentService` แบบ JSON + รองรับ CORS (เรียกจากโดเมน Cloudflare Pages)
- Cache ผลลัพธ์ (CacheService ~5–15 นาที) ลดโควตาและให้หน้าเว็บโหลดเร็ว
- Web App สิทธิ์ "Anyone with link" อ่านอย่างเดียว — ข้อมูลเป็น aggregate อยู่แล้ว ไม่มีข้อมูลรายบุคคล

## 4. แนวทาง Deploy (GitHub + Cloudflare Pages)

1. สร้าง GitHub repository เก็บโค้ด (`index.html`, `data/`, `docs/`)
2. เชื่อม repository กับ **Cloudflare Pages** (Framework: None / static site — ไม่มี build step)
3. ทุกครั้งที่ push ไปยัง branch `main` ระบบจะ deploy อัตโนมัติ ได้ URL เช่น `https://mayo-health-dashboard.pages.dev`
4. (ทางเลือก) ผูก custom domain ของหน่วยงาน
5. ระยะ production: ตั้งค่า `GAS_URL` ในหน้าเว็บ ชี้ไปยัง Web App ที่ deploy จาก Google Apps Script

ข้อดี: ฟรี, ไม่ต้องดูแล server, มี HTTPS อัตโนมัติ, rollback ได้ทุก commit

## 5. แผนระยะถัดไป (Roadmap)

| ระยะ | งาน |
|---|---|
| ระยะ 1 (ปัจจุบัน) | Prototype static + mock data — ใช้ประชุมขออนุมัติ |
| ระยะ 2 | ยืนยันชื่อ รพ.สต. จริง, ตกลงเกณฑ์สถานะ, สร้าง Google Sheets ตามโครงข้อ 2 |
| ระยะ 3 | เขียน GAS API + เชื่อมหน้าเว็บกับข้อมูลจริง, ทดสอบกับเจ้าของงาน 7 งาน |
| ระยะ 4 | Deploy ผ่าน GitHub + Cloudflare Pages, อบรมผู้กรอกข้อมูล, ใช้งานจริงรายเดือน |
