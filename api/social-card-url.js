import crypto from 'node:crypto';

function reply(res,status,data){res.status(status).json(data);}
function authorized(req){
  const expected=process.env.REVIEW_PASSWORD||'';
  const supplied=req.headers['x-review-password']||'';
  return expected&&supplied&&supplied===expected;
}
function sign(params,secret){
  return crypto.createHmac('sha256',secret).update(params.toString()).digest('hex');
}
export default async function handler(req,res){
  if(req.method!=='POST') return reply(res,405,{error:'Method not allowed'});
  if(!authorized(req)) return reply(res,401,{error:'Incorrect review password'});
  const {image='',category='K-POP',headline='',description=''}=req.body||{};
  if(!headline) return reply(res,400,{error:'Headline is required'});
  if(!image) return reply(res,400,{error:'Feature image is required'});
  const ts=Date.now().toString();
  const params=new URLSearchParams({image,category,headline,description,ts});
  const sig=sign(params,process.env.REVIEW_PASSWORD);
  params.set('sig',sig);
  const origin='https://hallyuscope.com';
  return reply(res,200,{
    imageUrl:origin+'/api/social-card?'+params.toString(),
    previewUrl:origin+'/social-card.html?'+new URLSearchParams({image,category,headline,description}).toString()
  });
}
