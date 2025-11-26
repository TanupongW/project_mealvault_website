# 🔍 Checklist: ตรวจสอบระบบ Recommendations

## ✅ ขั้นตอนที่ 1: ตรวจสอบ Backend Server

### 1.1 ตรวจสอบว่า Backend รันอยู่หรือไม่
```bash
cd Backend
npm run dev
```

**ต้องเห็น:**
```
✅ Supabase client initialized successfully
Server is running on port 3000
```

### 1.2 ทดสอบว่า Backend ทำงาน
เปิด browser ไปที่: `http://localhost:3000`
**ต้องเห็น:** `Hello, MealVault Backend!`

---

## ✅ ขั้นตอนที่ 2: ตรวจสอบการล็อกอิน

### 2.1 ล็อกอินผ่าน Frontend
- เปิดเว็บไซต์
- ล็อกอินด้วยบัญชีของคุณ
- ตรวจสอบว่าเห็นหน้า Home ได้

### 2.2 ตรวจสอบ Token
เปิด DevTools (F12) → Console → พิมพ์:
```javascript
localStorage.getItem('token')
// หรือ
sessionStorage.getItem('token')
```
**ต้องเห็น:** token string (ยาวๆ)

---

## ✅ ขั้นตอนที่ 3: ตรวจสอบข้อมูลพฤติกรรม

### 3.1 ดูเมนูหลายๆ อัน
- คลิกเข้าไปดูเมนู **อย่างน้อย 3-5 อัน**
- ดูรายละเอียดเมนู (ไม่ต้องกดไลค์)

### 3.2 ไลค์เมนู
- กดไลค์เมนู **อย่างน้อย 2-3 อัน** ที่คุณชอบ

### 3.3 ตรวจสอบว่าเก็บข้อมูลแล้ว
เปิด DevTools → Network → ดู request:
- `POST /api/behavior/menu/view` → Status 200
- `POST /api/menus/:id/like` → Status 200

---

## ✅ ขั้นตอนที่ 4: ทดสอบ API โดยตรง

### 4.1 ทดสอบ `/api/ai/recommendations`
เปิด Postman หรือ Terminal:

```bash
# 1. ล็อกอินเพื่อรับ token
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"user_email":"your@email.com","user_password":"yourpassword"}'

# 2. คัดลอก token จาก response แล้วใช้:
curl -X GET http://localhost:3000/api/ai/recommendations \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**ต้องเห็น:** JSON response ที่มี `recommendations` array

### 4.2 ทดสอบ `/api/menus/recommended-liked`
```bash
curl -X GET http://localhost:3000/api/menus/recommended-liked \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**ต้องเห็น:** Array ของเมนู (ไม่ใช่แค่เมนูที่เคยไลค์)

---

## ✅ ขั้นตอนที่ 5: ตรวจสอบ Frontend

### 5.1 เปิด DevTools → Network
- รีเฟรชหน้า Home (Hard Refresh: Ctrl+Shift+R)
- ดู request: `GET /api/ai/recommendations`
- คลิกดู Response

**ตรวจสอบ:**
- Status: 200 (ไม่ใช่ 401 หรือ 500)
- Response body มี `recommendations` array
- `recommendations.length` มากกว่า 5

### 5.2 ดู Console Log
เปิด DevTools → Console → ดู error messages

---

## ✅ ขั้นตอนที่ 6: ตรวจสอบ Backend Logs

ดู Terminal ที่รัน Backend → ดู error messages

**ปัญหาที่พบบ่อย:**
- `Error: Supabase client NOT initialized` → ตรวจสอบ `.env` file
- `Error: GEMINI_API_KEY not found` → ไม่เป็นไร ML จะทำงานได้
- `Error: JWT_SECRET not found` → ต้องตั้งค่า JWT_SECRET

---

## 🐛 ปัญหาที่พบบ่อย

### ปัญหา 1: "ไม่มี Token, การเข้าถึงถูกปฏิเสธ"
**แก้ไข:**
- ล็อกอินใหม่
- ตรวจสอบว่า token ถูกเก็บใน localStorage/sessionStorage

### ปัญหา 2: "ยังแนะนำแค่เมนูที่เคยไลค์"
**แก้ไข:**
- ตรวจสอบว่า Backend รันโค้ดเวอร์ชันใหม่แล้ว (รีสตาร์ท Backend)
- ตรวจสอบว่า Frontend รันโค้ดเวอร์ชันใหม่แล้ว (Hard Refresh)
- ตรวจสอบว่าใน database มีเมนูในหมวดหมู่เดียวกันกับที่เคยไลค์

### ปัญหา 3: "AI recommendations failed"
**แก้ไข:**
- ไม่เป็นไร ระบบจะ fallback ไปใช้ ML หรือ rule-based
- ตรวจสอบว่า ML recommendations ทำงาน (ดู `method: 'ml_content_based'`)

---

## 📝 วิธี Debug แบบละเอียด

### 1. เพิ่ม Log ใน Backend
แก้ไข `Backend/routes/aiRecommendRoutes.js`:

```javascript
router.get('/ai/recommendations', authMiddleware, async (req, res) => {
  const user_id = req.user.id;
  console.log('🔍 [DEBUG] User ID:', user_id);
  
  try {
    const behaviorData = await getUserBehaviorData(user_id);
    console.log('🔍 [DEBUG] Behavior Data:', JSON.stringify(behaviorData, null, 2));
    
    // ... rest of code
  }
});
```

### 2. ดู Response ใน Frontend
แก้ไข `Frontend/frontend/src/components/Recommended.jsx`:

```javascript
const aiData = await aiResp.json();
console.log('🔍 [DEBUG] AI Response:', aiData);
console.log('🔍 [DEBUG] Recommendations count:', aiData.recommendations?.length);
```

---

## ✅ Checklist สรุป

- [ ] Backend server รันอยู่ (port 3000)
- [ ] ล็อกอินสำเร็จ (มี token)
- [ ] ดูเมนูอย่างน้อย 3-5 อัน
- [ ] ไลค์เมนูอย่างน้อย 2-3 อัน
- [ ] API `/api/ai/recommendations` ทำงาน (Status 200)
- [ ] Response มี `recommendations` array
- [ ] `recommendations.length` มากกว่า 5
- [ ] Frontend แสดงเมนูใหม่ๆ (ไม่ใช่แค่เมนูที่เคยไลค์)

---

## 🆘 ถ้ายังไม่ได้ผล

1. **รีสตาร์ท Backend:**
   ```bash
   cd Backend
   # กด Ctrl+C เพื่อหยุด
   npm run dev
   ```

2. **Hard Refresh Frontend:**
   - Windows: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

3. **Clear Browser Cache:**
   - DevTools → Application → Clear storage → Clear site data

4. **ตรวจสอบ Database:**
   - ตรวจสอบว่าใน Supabase มีเมนูในหมวดหมู่เดียวกันกับที่คุณเคยไลค์
   - ตรวจสอบว่า `UserMenuView`, `MenuLike` มีข้อมูล

