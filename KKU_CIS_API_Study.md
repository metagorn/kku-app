# KKU CIS API Documentation Study

## ข้อมูลทั่วไป

**API Name:** Classroom API  
**Version:** 1.0.0  
**Specification:** OpenAPI 3.0  
**Base URL:** https://cis.kku.ac.th/api  
**Description:** API สำหรับจัดการข้อมูลห้องเรียน รวมถึงข้อมูลบริษัท โรงเรียน และโปรไฟล์ผู้ใช้

**Contact:** support@example.com

---

## หมวดหมู่ของ API Endpoints

### 1. Authentication (การยืนยันตัวตน)
- **Purpose:** จัดการการยืนยันตัวตนของผู้ใช้และ JWT Token
- **Endpoints:**
  - `POST /signin` - เข้าสู่ระบบของผู้ใช้

### 2. Profile (โปรไฟล์ผู้ใช้)
- **Purpose:** จัดการข้อมูลโปรไฟล์ผู้ใช้
- **Endpoints:**
  - `GET /profile` - ดึงข้อมูลโปรไฟล์ผู้ใช้
  - `PATCH /profile` - อัพเดทข้อมูลโปรไฟล์ผู้ใช้

### 3. Company (ข้อมูลบริษัท)
- **Purpose:** จัดการข้อมูลบริษัท
- **Endpoints:**
  - `GET /company` - ดึงข้อมูลบริษัททั้งหมด
  - `GET /company/{id}` - ดึงข้อมูลบริษัทตาม ID

### 4. School (ข้อมูลโรงเรียน)
- **Purpose:** จัดการข้อมูลโรงเรียน
- **Endpoints:**
  - `GET /school` - ดึงข้อมูลโรงเรียนทั้งหมด
  - `GET /school/{id}` - ดึงข้อมูลโรงเรียนตาม ID

### 5. Teacher (ข้อมูลอาจารย์)
- **Purpose:** จัดการข้อมูลอาจารย์
- **Endpoints:**
  - `GET /teacher` - ดึงข้อมูลอาจารย์ทั้งหมด

### 6. Class (ข้อมูลชั้นเรียน)
- **Purpose:** จัดการชั้นเรียนตามปีที่เข้าศึกษา
- **Endpoints:**
  - `GET /class/{id}` - ดึงข้อมูลผู้ใช้ตามปีที่เข้าศึกษา

### 7. Status (โพสต์สถานะ)
- **Purpose:** จัดการโพสต์สถานะและฟีเจอร์โซเชียล
- **Endpoints:**
  - `GET /status` - ดึงข้อมูลโพสต์สถานะทั้งหมด
  - `POST /status` - สร้างโพสต์สถานะใหม่
  - `GET /status/{id}` - ดึงข้อมูลโพสต์สถานะตาม ID
  - `DELETE /status/{id}` - ลบโพสต์สถานะ

### 8. Like (การกดไลค์)
- **Purpose:** ฟีเจอร์การกดไลค์และยกเลิกไลค์สำหรับโพสต์สถานะ
- **Endpoints:**
  - `POST /like` - กดไลค์โพสต์สถานะ
  - `DELETE /like` - ยกเลิกการไลค์โพสต์สถานะ
  - `DELETE /unlike` - ยกเลิกการไลค์โพสต์สถานะ (อีกทางเลือกหนึ่ง)

### 9. Comment (ความคิดเห็น)
- **Purpose:** จัดการความคิดเห็นสำหรับโพสต์สถานะ
- **Endpoints:**
  - `POST /comment` - เพิ่มความคิดเห็นให้กับโพสต์สถานะ
  - `DELETE /comment/{id}` - ลบความคิดเห็น

---

## Schema Models

API นี้มี Schema ต่างๆ ที่ใช้สำหรับการรับส่งข้อมูล ได้แก่:

### Core Models
- **User** - ข้อมูลผู้ใช้
- **Education** - ข้อมูลการศึกษา
- **Job** - ข้อมูลงาน
- **Company** - ข้อมูลบริษัท
- **School** - ข้อมูลโรงเรียน
- **Teacher** - ข้อมูลอาจารย์

### Request Models
- **SignInRequest** - ข้อมูลสำหรับการเข้าสู่ระบบ
- **ProfileUpdateRequest** - ข้อมูลสำหรับการอัพเดทโปรไฟล์
- **StatusCreateRequest** - ข้อมูลสำหรับการสร้างโพสต์สถานะ
- **LikeRequest** - ข้อมูลสำหรับการกดไลค์
- **CommentCreateRequest** - ข้อมูลสำหรับการสร้างความคิดเห็น
- **CommentDeleteRequest** - ข้อมูลสำหรับการลบความคิดเห็น

### Response Models
- **SignInResponse** - ผลตอบกลับการเข้าสู่ระบบ
- **ProfileResponse** - ผลตอบกลับข้อมูลโปรไฟล์
- **CompanyListResponse** - ผลตอบกลับรายการบริษัท
- **CompanyResponse** - ผลตอบกลับข้อมูลบริษัท
- **SchoolListResponse** - ผลตอบกลับรายการโรงเรียน
- **SchoolResponse** - ผลตอบกลับข้อมูลโรงเรียน
- **TeacherListResponse** - ผลตอบกลับรายการอาจารย์
- **StatusResponse** - ผลตอบกลับข้อมูลโพสต์สถานะ
- **StatusListResponse** - ผลตอบกลับรายการโพสต์สถานะ
- **ClassResponse** - ผลตอบกลับข้อมูลชั้นเรียน
- **ErrorResponse** - ผลตอบกลับเมื่อเกิดข้อผิดพลาด

### Additional Models
- **Status** - ข้อมูลโพสต์สถานะ
- **Comment** - ข้อมูลความคิดเห็น

---

## การเข้าสู่ระบบ (Authentication)

### POST /signin

**Description:** เข้าสู่ระบบของผู้ใช้

**ลักษณะการทำงาน:**
- ใช้สำหรับการยืนยันตัวตนของผู้ใช้
- ส่งคืน JWT Token สำหรับการใช้งาน API อื่นๆ
- เป็นจุดเริ่มต้นสำหรับการใช้งาน API ที่ต้องการการยืนยันตัวตน

**Request Body:** ใช้ SignInRequest Schema  
**Response:** ใช้ SignInResponse Schema

---

## การรักษาความปลอดภัย

API นี้ใช้ระบบ JWT (JSON Web Token) สำหรับการยืนยันตัวตน:
- ผู้ใช้ต้องเข้าสู่ระบบผ่าน `/signin` เพื่อรับ Token
- Token ที่ได้รับจะใช้สำหรับการเข้าถึง API endpoints อื่นๆ
- Token จะต้องส่งใน Header ของ HTTP Request

---

## หมายเหตุสำหรับการพัฒนา

1. **API Structure:** API ถูกออกแบบตาม RESTful principles
2. **Data Format:** ใช้ JSON สำหรับการรับส่งข้อมูล
3. **Authentication:** จำเป็นต้องมี JWT Token สำหรับ endpoints ที่ต้องการการยืนยันตัวตน
4. **Error Handling:** มี ErrorResponse Schema สำหรับการจัดการข้อผิดพลาด
5. **Social Features:** รองรับฟีเจอร์โซเชียลเช่น การโพสต์สถานะ, การกดไลค์, และการแสดงความคิดเห็น

---

## สรุป

KKU CIS API เป็น API ที่ครอบคลุมสำหรับระบบห้องเรียนออนไลน์ ที่รวมทั้งการจัดการข้อมูลผู้ใช้ ข้อมูลสถาบันการศึกษา และฟีเจอร์โซเชียลเน็ตเวิร์ก API ถูกออกแบบมาอย่างดีด้วย OpenAPI 3.0 specification และมีการจัดหมวดหมู่ endpoints อย่างชัดเจน

**วันที่ศึกษา:** 7 ตุลาคม 2025  
**แหล่งที่มา:** https://cis.kku.ac.th/api/docs