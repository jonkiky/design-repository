export const DEFAULT_CASE_ANALYSIS_COUNT = 3;

type CaseCandidate = {document_id:string; case_number?:string};

export function distinctCases<T extends CaseCandidate>(items:T[]):T[]{
  const seen=new Set<string>();
  return items.filter(item=>{
    const identity=item.case_number?.replace(/\s/g,'').replace(/（/g,'(').replace(/）/g,')')||item.document_id;
    if(seen.has(identity))return false;
    seen.add(identity);return true;
  });
}

export function defaultCaseIds(items:CaseCandidate[]):string[]{
  return distinctCases(items).slice(0,DEFAULT_CASE_ANALYSIS_COUNT).map(item=>item.document_id);
}
