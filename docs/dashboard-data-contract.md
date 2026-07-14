# DashboardSTN Data Contract

เอกสารนี้กำหนดโครงข้อมูลกลางสำหรับเชื่อมข้อมูล 7 งานเข้าหน้า DashboardSTN ผ่าน Google Sheets + Apps Script

## หลักการ

- 1 แถวในชีต `Data_*` = 1 หน่วยบริการ + 1 เดือน + 1 งาน
- ใช้คีย์หลักร่วมกันทุกชีต: `year`, `month`, `facility_id`, `facility_code`, `facility_name`
- เก็บเฉพาะข้อมูลสรุประดับหน่วยบริการ/อำเภอ ไม่มีข้อมูลผู้ป่วยรายบุคคล
- ชีต `Data_*` ใช้หัวตาราง 2 แถว: แถวที่ 1 เป็นภาษาไทยสำหรับผู้กรอก, แถวที่ 2 เป็น backend key ภาษาอังกฤษสำหรับระบบ
- ห้ามลบหรือเปลี่ยนแถว backend key ภาษาอังกฤษ เพราะ `gas/Code.gs` ใช้อ่านข้อมูลโดยตรง
- คอลัมน์คำอธิบายภาษาไทยอยู่ใน `MetricCatalog.metric_label`

## ชีตอ้างอิง

| Sheet | Purpose |
|---|---|
| `Facilities` | ทะเบียนหน่วยบริการ 13 แห่ง |
| `ProgramOwners` | รายชื่อ 7 งานและผู้รับผิดชอบ |
| `MetricCatalog` | รายการตัวชี้วัดที่นำไปแสดงบน dashboard และกฎคำนวณ |
| `DataContract` | คำอธิบายคอลัมน์ของทุก `Data_*` sheet |
| `BackendMapping` | mapping ระหว่างชีตกับ JSON ที่หน้าเว็บต้องการ |

## ชีตข้อมูลที่เจ้าของงานกรอก

| Sheet | Program |
|---|---|
| `Data_NCD` | งานโรคไม่ติดต่อเรื้อรัง |
| `Data_MCH` | งานอนามัยแม่และเด็ก |
| `Data_Vaccine` | งานวัคซีน |
| `Data_ECD` | งานเด็กปฐมวัย |
| `Data_Dental` | งานทันตกรรม |
| `Data_Elderly` | งานผู้สูงอายุ |
| `Data_Cancer` | งานมะเร็ง |

## Backend Mapping

`gas/Code.gs` จะตรวจว่ามี contract รุ่นใหม่หรือไม่จากชีต `Data_Cancer`:

- ต้องมีคอลัมน์ `facility_code`
- ต้องมีคอลัมน์ `women_30_60_target`

ถ้าพบ contract รุ่นใหม่ จะใช้ `buildDataFromContract_()` เพื่อประกอบ JSON:

| JSON path | Source |
|---|---|
| `facilities[]` | `Facilities` |
| `programs[]` | `ProgramOwners` + `MetricCatalog` + `Data_*` |
| `facilityProgress[]` | `Data_Vaccine` + `Data_Cancer` |
| `monthlyProgress.vaccine` | `Data_Vaccine` |
| `cancerTracking` | `Data_Cancer` |

ถ้ายังไม่พบ contract รุ่นใหม่ ระบบจะ fallback ไปใช้โครงเดิมผ่าน `buildLegacyData_()`

หมายเหตุ: `readRows_()` รองรับชีตที่มีหัวตาราง 2 แถวแล้ว ถ้าแถวแรกไม่พบ `year` แต่แถวที่สองพบ `year` ระบบจะใช้แถวที่สองเป็นชื่อคอลัมน์จริง

## ไฟล์ Workbook

ไฟล์ template และ contract ที่จัดรูปแล้วอยู่ที่:

`outputs/dashboard-contract/DashboardSTN_backend_contract.xlsx`

นำไฟล์นี้ไปใช้ได้ 2 แบบ:

1. Import เข้า Google Sheets แล้วให้เจ้าของงานกรอกข้อมูลในชีต `Data_*`
2. รัน `setupDataContractSheets()` ใน Apps Script เพื่อสร้างหัวตาราง contract รุ่นใหม่ใน Google Sheets เดิม
