import { useState, type FC } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar, Topbar } from './components/layout';
import type { Page } from './types';
import { Dashboard, Execution, HistoryPage, Knowledge, Landing, NewStartup, Reports, SettingsPage } from './pages';
const pageMap:Record<Page, FC<{setPage:(p:Page)=>void}>>={landing:Landing,dashboard:Dashboard,'new-startup':NewStartup,execution:Execution,reports:Reports,history:HistoryPage,knowledge:Knowledge,settings:SettingsPage};
export default function App(){const [page,setPage]=useState<Page>('landing'); const Active=pageMap[page]; if(page==='landing')return <Active setPage={setPage}/>; return <div className="app-shell"><Sidebar page={page} setPage={setPage}/><main className="main"><Topbar setPage={setPage}/><AnimatePresence mode="wait"><motion.div key={page} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-5}} transition={{duration:.22}} className="content"><Active setPage={setPage}/></motion.div></AnimatePresence></main></div>}
