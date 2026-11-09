const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function send(res,status,payload){
  res.status(status).setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(payload));
}

export default async function handler(req,res){
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
    return send(res,405,{error:'Method not allowed.'});
  }

  try{
    const body=typeof req.body==='string' ? JSON.parse(req.body||'{}') : (req.body||{});
    const email=String(body.email||'').trim().toLowerCase();
    const honeypot=String(body.website||'').trim();

    if(honeypot) return send(res,200,{message:'You’re on the list.'});
    if(!EMAIL_RE.test(email)||email.length>254){
      return send(res,400,{error:'Please enter a valid email address.'});
    }

    const apiKey=process.env.BREVO_API_KEY;
    const rawListId=process.env.BREVO_LIST_ID;
    const listId=Number(rawListId);

    if(!apiKey||!rawListId||!Number.isInteger(listId)||listId<=0){
      console.error('Newsletter backend is missing BREVO_API_KEY or BREVO_LIST_ID');
      return send(res,503,{error:'Newsletter signup is temporarily unavailable.'});
    }

    const brevoRes=await fetch('https://api.brevo.com/v3/contacts',{
      method:'POST',
      headers:{
        'accept':'application/json',
        'api-key':apiKey,
        'content-type':'application/json'
      },
      body:JSON.stringify({
        email,
        listIds:[listId],
        updateEnabled:true
      })
    });

    if(!brevoRes.ok){
      const detail=await brevoRes.text();
      console.error('Brevo subscribe failed',brevoRes.status,detail);
      return send(res,502,{error:'We could not add you right now. Please try again.'});
    }

    return send(res,200,{message:'You’re on the list. Check your inbox for future HallyuScope updates.'});
  }catch(error){
    console.error('Newsletter subscribe error',error);
    return send(res,500,{error:'Something went wrong. Please try again.'});
  }
}
