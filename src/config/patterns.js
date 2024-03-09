const idReq = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,12}$/
const pwReq =/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()-_+=])[A-Za-z\d!@#$%^&*()-_+=]{6,16}$/
const nameReq = /^[a-zA-Z가-힣]{2,50}$/
const nicknameReq = /^[a-zA-Z가-힣]{2,50}$/
const emailReq = /^[0-9a-zA-Z._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
const telReq = /^[0-9]{11}$/
const dateReq = /^\d{4}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])$/
const genderReq = /^(1|2)$/
const addressReq = /^(?![\s]+$)[가-힣a-zA-Z\s]{2,}$/

module.exports ={idReq,pwReq,nameReq,nicknameReq,emailReq,telReq,dateReq,genderReq,addressReq};