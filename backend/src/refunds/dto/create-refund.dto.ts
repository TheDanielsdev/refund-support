import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateRefundDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9-]{3,20}$/, { message: 'orderNumber must be 3-20 letters, digits or dashes' })
  orderNumber!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  message!: string;
}
