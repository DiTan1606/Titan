/** Số tài khoản hợp lệ: 6–19 chữ số (VCB thường 10 hoặc 13 số) */
export const isAccountNumber = (digits: string) => /^\d{6,19}$/.test(digits)

/** Nhóm số tài khoản kiểu VCB: 4 số đầu, sau đó từng nhóm 3 số (1012 345 678, 1012 345 678 901) */
export const groupAccount = (digits: string) =>
  digits.length <= 4 ? digits : `${digits.slice(0, 4)} ${digits.slice(4).replace(/(\d{3})(?=\d)/g, '$1 ')}`
