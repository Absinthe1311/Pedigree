//规定注册接口接收的请求体必须包含哪些字段。Controller用它来接收和验证前端传来的数据
export class RegisterDto {
    userName : string;  //用户名
    password : string;  //密码明文
}