import {EventEmitter} from 'node:events';
import {resolve4} from 'node:dns/promises';
import {request} from 'node:https';
import {readPublicService,checkPublicLink} from './link-check';
jest.mock('node:dns/promises',()=>({resolve4:jest.fn()}));
jest.mock('node:https',()=>({request:jest.fn()}));
const dns=resolve4 as jest.Mock,https=request as jest.Mock;
function response(status:number,body:string,type='application/json'){
 https.mockImplementation((_url:URL,_options:unknown,callback:(value:unknown)=>void)=>{
  const req=Object.assign(new EventEmitter(),{end:()=>queueMicrotask(()=>{
   const res=Object.assign(new EventEmitter(),{statusCode:status,headers:{'content-type':type},destroy:jest.fn()});callback(res);res.emit('data',Buffer.from(body));res.emit('end');
  }),destroy:jest.fn()});return req;
 });
}
beforeEach(()=>{jest.clearAllMocks();dns.mockResolvedValue(['8.8.8.8']);});
test('service reader pins the validated address and forwards no credentials',async()=>{
 response(200,JSON.stringify({status:'ready',version:'1',checkedAt:'2026-10-14T00:00:00Z',token:'private'}));
 const result=await readPublicService('https://service.example/api/service-info');expect(result).not.toHaveProperty('token');
 const options=https.mock.calls[0][1];expect(options.method).toBe('GET');expect(options.headers).not.toHaveProperty('Authorization');expect(options.headers).not.toHaveProperty('Cookie');const callback=jest.fn();options.lookup('service.example',{},callback);expect(callback).toHaveBeenCalledWith(null,'8.8.8.8',4);expect(dns).toHaveBeenCalledTimes(1);
});
test('mixed public/private DNS and credential URLs are blocked before a request',async()=>{
 dns.mockResolvedValue(['8.8.8.8','127.0.0.1']);await expect(readPublicService('https://service.example/status')).rejects.toThrow();expect(https).not.toHaveBeenCalled();
 await expect(readPublicService('https://user:secret@service.example/status')).rejects.toThrow();await expect(readPublicService('https://service.example:8443/status')).rejects.toThrow();expect(https).not.toHaveBeenCalled();
});
test('service reader never follows redirects or buffers oversized JSON',async()=>{
 response(302,'{}');await expect(readPublicService('https://service.example/status')).rejects.toThrow();expect(https).toHaveBeenCalledTimes(1);
 response(200,' '.repeat(16385));await expect(readPublicService('https://service.example/status')).rejects.toThrow();expect(https).toHaveBeenCalledTimes(2);
});
test('link checks use HEAD and report redirects without following them',async()=>{
 response(302,'');const result=await checkPublicLink('https://service.example/page');expect(result.result).toMatch(/not followed/);expect(https.mock.calls[0][1].method).toBe('HEAD');expect(https).toHaveBeenCalledTimes(1);
});
