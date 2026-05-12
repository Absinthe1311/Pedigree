// 这个地方定义创建成员的时候需要传入的信息
export class CreateMemberDto {
    name: string;
    gender?: string;
    birth?: string;
    death?: string;
    bio?: string;
    fatherId?: number;
    motherId?: number;
    generation?: number;
}