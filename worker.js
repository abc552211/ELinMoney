export default {
  async fetch(request, env) {
    // 處理前端跨域請求 (CORS)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    try {
      const { imageBase64 } = await request.json();
      if (!imageBase64) {
        return new Response(JSON.stringify({ error: "缺少圖片資料" }), { status: 400, headers: corsHeaders });
      }

      // 1. 從 Cloudflare 環境變數中取出你的 Gemini API Key
      const API_KEY = env.GEMINI_API_KEY; 
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

      // 2. 建構發送給 Gemini 的請求內容
      const geminiPayload = {
        "contents": [{
          "parts": [
            { "text": "你是一位專業的記帳助手。請仔細閱讀這張發票或收據影像，提取總金額、並根據消費品項自動分類。必須嚴格依照要求的 JSON 格式回傳。" },
            {
              "inlineData": {
                "mimeType": "image/jpeg",
                "data": imageBase64
              }
            }
          ]
        }],
        "generationConfig": {
          "responseMimeType": "application/json",
          // 3. 🌟 最強核心：強制 Gemini 只能回傳你指定的結構，不能講廢話
          "responseSchema": {
            "type": "OBJECT",
            "properties": {
              "amount": { "type": "NUMBER", "description": "發票或收據上的最終消費總金額" },
              "mainCat": { "type": "STRING", "description": "大分類，必須從中選擇：[生活支出, 理財支出, 其他支出]" },
              "subCat": { "type": "STRING", "description": "細項小分類，例如：食物、日用品、交通、娛樂、醫療" },
              "note": { "type": "STRING", "description": "簡短摘要購買的店家與主要品項，例如：麥當勞午餐" }
            },
            "required": ["amount", "mainCat", "subCat", "note"]
          }
        }
      };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload)
      });

      const data = await response.json();
      // 提取 Gemini 回傳的結構化 JSON 字串
      const aiResponseText = data.candidates[0].content.parts[0].text;

      return new Response(aiResponseText, {
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=UTF-8" }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
  }
};
