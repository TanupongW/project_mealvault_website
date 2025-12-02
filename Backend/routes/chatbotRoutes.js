const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { supabase } = require('../config/supabase');

// นำ API Key มาจาก .env
// ตรวจสอบว่ามี API Key หรือไม่
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('⚠️ WARNING: GEMINI_API_KEY is not set in .env file!');
}
const genAI = new GoogleGenerativeAI(apiKey);

// สร้าง API Endpoint สำหรับ Chatbot
// POST /api/chatbot/send
router.post('/chatbot/send', async (req, res) => {
  try {
    // ตรวจสอบ API Key ก่อน
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY กรุณาใส่ API Key ในไฟล์ .env' });
    }

    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'กรุณาส่งข้อความ' });
    }

    // ดึงข้อมูลเมนูจาก database
    let menusData = [];
    try {
      // ตรวจสอบว่าคำถามเกี่ยวกับการแนะนำเมนูหรือไม่
      const messageLower = message.toLowerCase();
      const isMenuRecommendation = 
        messageLower.includes('แนะนำ') || 
        messageLower.includes('เมนู') || 
        messageLower.includes('อาหาร') ||
        messageLower.includes('ทำอะไร') ||
        messageLower.includes('กินอะไร');

      if (isMenuRecommendation) {
        // ถ้าคำถามเกี่ยวกับการแนะนำเมนู ให้ค้นหาเมนูที่เกี่ยวข้อง
        // สกัดคำสำคัญจากคำถาม (เช่น "ไข่", "หมู", "ผัด")
        const keywords = messageLower
          .split(/\s+/)
          .filter(word => word.length > 1 && !['แนะนำ', 'เมนู', 'อาหาร', 'ทำ', 'กิน', 'อะไร', 'จาก', 'มี'].includes(word))
          .slice(0, 3); // ใช้แค่ 3 คำสำคัญแรก

        if (keywords.length > 0) {
          // ค้นหาเมนูที่เกี่ยวข้องกับคำสำคัญ
          const searchTerms = keywords.map(k => `%${k}%`);
          let relevantMenus = [];

          // ค้นหาในชื่อเมนู
          for (const term of searchTerms) {
            const { data: menusByName, error: nameError } = await supabase
              .from('Menu')
              .select('menu_id, menu_name, menu_description, menu_recipe, category_id')
              .ilike('menu_name', term)
              .limit(20);
            
            if (!nameError && menusByName) {
              relevantMenus.push(...menusByName);
            }
          }

          // ค้นหาในคำอธิบายและสูตร (ค้นหาแยกกันแล้วรวมผลลัพธ์)
          for (const term of searchTerms) {
            // ค้นหาในคำอธิบาย
            const { data: menusByDesc, error: descError } = await supabase
              .from('Menu')
              .select('menu_id, menu_name, menu_description, menu_recipe, category_id')
              .ilike('menu_description', term)
              .limit(20);
            
            if (!descError && menusByDesc) {
              relevantMenus.push(...menusByDesc);
            }

            // ค้นหาในสูตร
            const { data: menusByRecipe, error: recipeError } = await supabase
              .from('Menu')
              .select('menu_id, menu_name, menu_description, menu_recipe, category_id')
              .ilike('menu_recipe', term)
              .limit(20);
            
            if (!recipeError && menusByRecipe) {
              relevantMenus.push(...menusByRecipe);
            }
          }

          // ลบเมนูซ้ำ
          const uniqueMenus = Array.from(
            new Map(relevantMenus.map(m => [m.menu_id, m])).values()
          );
          
          menusData = uniqueMenus.length > 0 ? uniqueMenus : [];
        }

        // ถ้ายังไม่มีเมนูที่เกี่ยวข้อง หรือต้องการให้มีตัวเลือกมากขึ้น
        // ให้ดึงเมนูเพิ่มเติม (ยอดนิยมหรือล่าสุด)
        if (menusData.length < 10) {
          const { data: additionalMenus, error: additionalError } = await supabase
            .from('Menu')
            .select('menu_id, menu_name, menu_description, menu_recipe, category_id')
            .order('menu_like_count', { ascending: false })
            .limit(30);
          
          if (!additionalError && additionalMenus) {
            // รวมเมนูที่เกี่ยวข้องกับเมนูเพิ่มเติม (ไม่ให้ซ้ำ)
            const existingIds = new Set(menusData.map(m => m.menu_id));
            const newMenus = additionalMenus.filter(m => !existingIds.has(m.menu_id));
            menusData = [...menusData, ...newMenus].slice(0, 50); // จำกัดไว้ที่ 50 เมนู
          }
        }
      } else {
        // ถ้าไม่ใช่คำถามเกี่ยวกับการแนะนำเมนู ให้ดึงเมนูจำนวนน้อยเพื่อใช้เป็นข้อมูลอ้างอิง
        const { data: menus, error: menuError } = await supabase
          .from('Menu')
          .select('menu_id, menu_name, menu_description, menu_recipe, category_id')
          .limit(20);
        
        if (menuError) {
          console.error('Error fetching menus:', menuError);
        } else {
          menusData = menus || [];
        }
      }
    } catch (dbError) {
      console.error('Error connecting to database:', dbError);
    }

    // สร้าง JSON string ของเมนูเพื่อส่งให้ AI
    const menusJson = menusData.length > 0 
      ? JSON.stringify(menusData.map(m => ({
          menu_id: m.menu_id,
          menu_name: m.menu_name,
          menu_description: m.menu_description || '',
          menu_recipe: m.menu_recipe || '',
          category_id: m.category_id || ''
        })))
      : '[]';

    // สร้าง prompt ที่รวมข้อมูลเมนูจาก database
    let prompt = `คุณคือ Mealer AI ผู้ช่วยด้านอาหาร ตอบคำถามเกี่ยวกับ:
- แนะนำเมนูอาหารจากวัตถุดิบเหลือใช้
- วิธีเก็บรักษาวัตถุดิบ
- วิธีทำอาหารและสูตรอาหาร
- คำแนะนำโภชนาการ

**กฎสำคัญสำหรับการแนะนำเมนู:**
1. เมื่อมีการแนะนำเมนูอาหาร คุณต้องแนะนำเฉพาะเมนูที่มีอยู่ในรายการเมนูจากฐานข้อมูลด้านล่างเท่านั้น
2. ห้ามสร้างชื่อเมนูใหม่หรือแนะนำเมนูที่ไม่มีในรายการ
3. ใช้เฉพาะ menu_id และ menu_name ที่มีอยู่ในรายการเมนูด้านล่าง
4. ถ้าคำถามเกี่ยวกับการแนะนำเมนู ให้ระบุ menu_id และ menu_name จากรายการที่มีอยู่
   - รูปแบบที่แนะนำ: "**menu_id: M123456789, menu_name: ชื่อเมนู**" หรือ "**M123456789: ชื่อเมนู**"
   - ต้องระบุ menu_id ทุกครั้งที่แนะนำเมนู
5. ถ้าไม่มีเมนูที่ตรงกับคำถาม ให้บอกผู้ใช้ว่าไม่มีเมนูที่ตรงกับความต้องการในฐานข้อมูลของเรา`;

    if (menusData.length > 0) {
      prompt += `\n\nรายการเมนูจากฐานข้อมูล (JSON) - ใช้เฉพาะเมนูเหล่านี้เท่านั้น:
${menusJson}`;
    } else {
      prompt += `\n\n**หมายเหตุ:** ตอนนี้ยังไม่มีเมนูในฐานข้อมูลที่เกี่ยวข้องกับคำถามของคุณ`;
    }

    prompt += `\n\nตอบเป็นภาษาไทย อย่างเป็นมิตรและมีประโยชน์\n\nคำถาม: ${message}`;

    // ใช้ generative model - ต้องระบุ model name
    // ต้องตรวจสอบว่า genAI ถูกสร้างถูกต้อง
    if (!genAI) {
      throw new Error('ไม่สามารถสร้าง GoogleGenerativeAI instance ได้');
    }
    
    // ใช้ model gemini-2.5-flash ตาม Google Quickstart ล่าสุด
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // สกัด menu_id ที่ AI แนะนำจากข้อความตอบกลับ
    // รูปแบบที่คาดหวัง: "M282262018: งบไก่" หรือ "menu_id: M282262018" หรือ "M282262018" หรือ "M123456"
    // รองรับทั้งรูปแบบ M + ตัวเลข (อย่างน้อย 6 หลัก)
    const menuIdPattern = /M\d{6,}/g;
    const mentionedMenuIds = text.match(menuIdPattern) || [];
    const uniqueMenuIds = [...new Set(mentionedMenuIds)];

    // ดึงข้อมูลเมนูที่ถูกแนะนำ
    let recommendedMenus = [];
    if (uniqueMenuIds.length > 0) {
      try {
        const { data: menus, error: menuError } = await supabase
          .from('Menu')
          .select('menu_id, menu_name, menu_image, menu_description')
          .in('menu_id', uniqueMenuIds);
        
        if (!menuError && menus) {
          recommendedMenus = menus;
        }
      } catch (err) {
        console.error('Error fetching recommended menus:', err);
      }
    }

    res.json({ 
      reply: text,
      recommendedMenus: recommendedMenus // ส่งข้อมูลเมนูที่แนะนำกลับไปด้วย
    });

  } catch (error) {
    console.error('Error with Gemini API:', error);
    console.error('API Key:', process.env.GEMINI_API_KEY ? 'มีอยู่' : 'ไม่มี');
    console.error('Error message:', error.message);
    
    // ตรวจสอบว่าเป็นปัญหา API Key หรือไม่
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในไฟล์ .env กรุณาตรวจสอบการตั้งค่า' });
    }
    
    // แสดง error แบบละเอียด
    const errorMsg = error.message || 'Unknown error';
    res.status(500).json({ 
      error: `เกิดข้อผิดพลาด: ${errorMsg}`,
      details: 'กรุณาตรวจสอบ API Key และลองสร้างใหม่'
    });
  }
});


module.exports = router;