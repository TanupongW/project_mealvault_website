-- Migration: เพิ่ม is_active field สำหรับระงับ/เปิดใช้งานบัญชีผู้ใช้
-- Run this in Supabase SQL editor

-- เพิ่มคอลัมน์ is_active ในตาราง User (default true สำหรับผู้ใช้ที่มีอยู่แล้ว)
alter table "User" add column if not exists is_active boolean default true;

-- อัปเดตผู้ใช้ที่มีอยู่แล้วให้เป็น active
update "User" set is_active = true where is_active is null;

