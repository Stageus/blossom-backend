const idReq = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,12}$/
const pwReq =/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()-_+=])[A-Za-z\d!@#$%^&*()-_+=]{6,16}$/
const nameReq = /^[a-zA-Z가-힣]{2,50}$/
const nicknameReq = /^[a-zA-Z가-힣]{2,50}$/
const telReq = /^[0-9]{11}$/
const dateReq = /^\d{4}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])$/
const imageReq = /\.(jpg|jpeg|png|gif)$/i;

module.exports ={idReq,pwReq,nameReq,nicknameReq,imageReq,telReq,dateReq};