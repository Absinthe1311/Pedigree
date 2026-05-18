import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

import {Routes, Route, Navigate} from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import FamilyListPage from './pages/FamilyListPage'
import DashboardPage from './pages/DashboardPage'

export default function App() {
  return (
    <Routes>
      {/* 根路径重定向到登录页*/}
      <Route path ="/" element={<Navigate to = "/login" replace/>} />

      <Route path ="/login" element={<LoginPage/>}/>

      <Route path ="/register" element={<RegisterPage/>}/>

      <Route path = "/dashboard" element = {<DashboardPage/>}/>

      <Route path = "/families" element = {<FamilyListPage/>}/>
    </Routes>
  )
}
