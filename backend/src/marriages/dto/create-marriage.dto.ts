export class CreateMarriageDto {
    member1Id: number; 
    member2Id: number; // 必填的双方的memberId,后续service会确保两个的顺序
    marryDate?: string; // 两个可以选填的日期
    divorceDate?: string;
}