import React from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import MenuSuggestion from '../components/MenuSuggestion';
import Recommended from '../components/Recommended';
import UserPosts from '../components/UserPosts';

function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex flex-col">
      <Navbar />
      
      <main className="flex-grow pt-24">
        <div className="container mx-auto px-6 sm:px-8 max-w-7xl"> 
          {/* Hero Section with modern design */}
          <div className="mb-16">
            <Hero />
          </div>
          
          {/* Recommended menus based on your behavior and likes */}
          <div className="mb-16">
            <Recommended />
          </div>
          <div className="mb-16">
            <MenuSuggestion />
          </div>
          
          {/* User Posts Section */}
          <div className="mb-16">
            <UserPosts />
          </div>
          
          {/* Footer-like decorative element */}
          <div className="text-center py-12 mt-20">
            <div className="inline-block px-8 py-4 bg-white rounded-full shadow-lg">
              <p className="text-green-700 font-semibold">
                🌱 เลือกเมนูอาหารจากวัตถุดิบเหลือใช้ - รักษ์โลก รักษ์กระเป๋า 🌱
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default HomePage;