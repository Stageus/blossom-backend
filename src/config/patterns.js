const idReq = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,12}$/
const pwReq =/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()-_+=])[A-Za-z\d!@#$%^&*()-_+=]{6,16}$/
const nameReq = /^[a-zA-Z가-힣]{2,50}$/
const nicknameReq = /^[a-zA-Z가-힣]{2,50}$/
const telReq = /^[0-9]{11}$/
const dateReq = /^\d{4}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])$/
const imageReq = /\.(jpg|jpeg|png|gif)$/i;
const commentReq = /^.{1,50}$/; // 댓글 1~50자
const timestampReq = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/; //YYYY-MM-DD HH:MM:SS
const scheduleReq = /^.{1,20}$/; // 일정 1~20자
const feedReq = /^.{1,200}$/; // 피드 1~200자

module.exports ={idReq,pwReq,nameReq,nicknameReq,imageReq,telReq,dateReq,commentReq,timestampReq,scheduleReq,feedReq};