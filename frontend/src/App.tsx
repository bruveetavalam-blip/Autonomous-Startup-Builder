import { useState, type FC } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar, Topbar } from './components/layout';
import type { Page } from './types';
import { Dashboard, Execution, HistoryPage, Knowledge, Landing, LoginPage, NewStartup, Reports, SettingsPage, SignupPage } from './pages';
import type { UserProfile } from './types';
import { LiveExecution } from './components/LiveExecution';
import { LiveReports } from './components/LiveReports';
import { LocationStartup } from './components/LocationStartup';
const pageMap:Record<Page, FC<{setPage:(p:Page)=>void;user:UserProfile|null;setUser:(u:UserProfile|null)=>void}>>={landing:Landing,signup:SignupPage,login:LoginPage,dashboard:Dashboard,'new-startup':LocationStartup,execution:LiveExecution,reports:LiveReports,history:HistoryPage,knowledge:Knowledge,settings:SettingsPage};
const savedUser=()=>{try{const value=localStorage.getItem('startup_builder_user');return value?JSON.parse(value) as UserProfile:null;}catch{return null;}};
export default function App(){const [page,setPage]=useState<Page>('landing'); const [user,setUserState]=useState<UserProfile|null>(savedUser); const setUser=(value:UserProfile|null)=>{setUserState(value); if(value)localStorage.setItem('startup_builder_user',JSON.stringify(value));else localStorage.removeItem('startup_builder_user');}; const Active=pageMap[page]; if(page==='landing'||page==='signup'||page==='login')return <Active setPage={setPage} user={user} setUser={setUser}/>; return <div className="app-shell"><Sidebar page={page} setPage={setPage} user={user}/><main className="main"><Topbar setPage={setPage} user={user}/><AnimatePresence mode="wait"><motion.div key={page} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-5}} transition={{duration:.22}} className="content"><Active setPage={setPage} user={user} setUser={setUser}/></motion.div></AnimatePresence></main></div>}
