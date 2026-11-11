import {useEffect, useState} from 'react';

// Layout preferences are local to this browser, never part of case inputs.
export function useLayoutPreference(key:string){
  const [collapsed,setCollapsed]=useState(()=>{
    try{return localStorage.getItem(key)==='true'}catch{return false}
  });
  useEffect(()=>{
    try{localStorage.setItem(key,String(collapsed))}catch{/* Storage may be disabled. */}
  },[key,collapsed]);
  return [collapsed,setCollapsed] as const;
}
