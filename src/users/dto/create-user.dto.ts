import { IsEmail, IsNotEmpty,IsOptional,MinLength } from 'class-validator';
export class CreateUserDto {

    @IsNotEmpty({message: 'Name is required'})
    name: string;

    @IsEmail()
    email: string;  

    @MinLength(8, {message: 'Password must be at least 8 characters long'})
    password: string;

    @IsOptional()
    currency: string = '$';
}