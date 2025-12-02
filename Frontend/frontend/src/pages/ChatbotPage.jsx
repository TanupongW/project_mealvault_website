import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { API_URL, IMAGE_URL } from '../config/api';

const initialMessage = { 
  sender: 'ai', 
  text: 'สวัสดีค่ะ มีอะไรให้ช่วยเกี่ยวกับเมนูอาหาร หรือวัตถุดิบไหมคะ?',
  recommendedMenus: []
};

function ChatbotPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([initialMessage]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/chatbot/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const aiMessage = { 
        sender: 'ai', 
        text: data.reply,
        recommendedMenus: data.recommendedMenus || []
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage = { sender: 'ai', text: `ขออภัยค่ะ เกิดข้อผิดพลาด: ${error.message}` };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClearChat = () => {
    setMessages([initialMessage]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-white flex flex-col relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-72 h-72 bg-green-200 rounded-full opacity-10 blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-emerald-200 rounded-full opacity-10 blur-3xl animate-pulse delay-75"></div>
      </div>
      
      <Navbar />
      <main className="flex-grow pt-20 flex flex-col items-center w-full relative z-10">
        <div className="w-full max-w-4xl flex-grow flex flex-col bg-white/90 backdrop-blur-lg shadow-2xl rounded-t-3xl my-6 border border-green-100 overflow-hidden">
          
          {/* --- ส่วนหัวของ Chat --- */}
          <div className="p-6 border-b-2 border-green-100 bg-gradient-to-r from-green-500 to-emerald-500">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-2xl">🤖</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Mealer AI</h1>
                  <p className="text-sm text-green-50">AI ช่วยแนะนำเมนูอาหาร</p>
                </div>
              </div>
              <button 
                onClick={handleClearChat}
                className="bg-white/20 hover:bg-white/30 text-white font-semibold py-2 px-4 rounded-full transition-all duration-300 transform hover:scale-105"
                title="เริ่มต้นการสนทนาใหม่"
              >
                🔄 ล้างแชท
              </button>
            </div>
          </div>
          
          {/* --- ส่วนแสดงข้อความ (ที่เคยหายไป) --- */}
          <div className="flex-grow p-6 space-y-4 overflow-y-auto bg-gray-50">
            {messages.map((msg, index) => (
              <div key={index} className={`flex items-end space-x-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender === 'ai' && (
                  <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">🤖</span>
                  </div>
                )}
                <div className={`px-5 py-3 rounded-2xl max-w-[75%] shadow-md ${msg.sender === 'user' ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none border border-gray-100'}`}>
                  <p style={{whiteSpace: 'pre-wrap'}} className="leading-relaxed">{msg.text}</p>
                  
                  {/* แสดงเมนูที่แนะนำเป็น cards */}
                  {msg.sender === 'ai' && msg.recommendedMenus && msg.recommendedMenus.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                        <span className="mr-2">🍽️</span>
                        เมนูที่แนะนำ:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {msg.recommendedMenus.map((menu) => (
                          <div
                            key={menu.menu_id}
                            onClick={() => navigate(`/menus/${menu.menu_id}`)}
                            className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-3 cursor-pointer hover:shadow-lg hover:border-green-400 hover:scale-[1.02] transition-all duration-200 group"
                          >
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0">
                                {menu.menu_image ? (
                                  <img
                                    src={menu.menu_image.startsWith('http') ? menu.menu_image : `${IMAGE_URL}/${menu.menu_image}`}
                                    alt={menu.menu_name}
                                    className="w-20 h-20 object-cover rounded-lg shadow-md"
                                    onError={(e) => {
                                      e.target.src = 'https://via.placeholder.com/80x80?text=Menu';
                                    }}
                                  />
                                ) : (
                                  <div className="w-20 h-20 bg-gradient-to-br from-green-200 to-emerald-300 rounded-lg flex items-center justify-center shadow-md">
                                    <span className="text-3xl">🍲</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-800 group-hover:text-green-600 truncate text-base">
                                  {menu.menu_name}
                                </h4>
                                {menu.menu_description && (
                                  <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                                    {menu.menu_description}
                                  </p>
                                )}
                                <div className="mt-2 flex items-center">
                                  <span className="text-xs text-green-600 font-semibold group-hover:text-green-700">
                                    คลิกเพื่อดูรายละเอียด
                                  </span>
                                  <span className="ml-1 text-green-600 group-hover:translate-x-1 transition-transform">→</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {msg.sender === 'user' && (
                  <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">👤</span>
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="px-4 py-2 rounded-2xl max-w-lg bg-gray-200 text-gray-800 rounded-bl-none">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* --- ส่วนพิมพ์ข้อความ (ที่เคยหายไป) --- */}
          <div className="p-4 bg-gray-100 border-t rounded-b-xl">
            <div className="flex space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSend()}
                className="w-full px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="ลองถามอะไรสักหน่อยสิ..."
                disabled={isLoading}
              />
              <button onClick={handleSend} disabled={isLoading} className="bg-green-500 text-white font-bold rounded-full px-6 py-2 hover:bg-green-600 disabled:bg-gray-400 transition-colors">
                ส่ง
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ChatbotPage;
