import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { AutomationPolicyService } from "../automation-policies/automation-policy.service.js";
import type { AcademicYearInput, SchoolClassInput, SchoolSectionInput, SchoolStudentInput, SchoolStudentUpdateInput, SchoolSubjectInput, SchoolTeacherInput, SchoolTeacherAssignmentInput, StudentAttendanceInput, TeacherAttendanceInput, SchoolTimetableEntryInput, SchoolSubstituteInput } from "./school.validation.js";

export class SchoolService {
  private policyEngine = new AutomationPolicyService();
  async list(organizationId: string) {
    const academicYears = await prisma.schoolAcademicYear.findMany({
      where: { organizationId, deletedAt: null },
      include: { classes: { where: { organizationId, deletedAt: null }, include: { sections: { where: { organizationId, deletedAt: null }, orderBy: { name: "asc" } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
      orderBy: [{ isCurrent: "desc" }, { startsOn: "desc" }],
    });
    const students = await prisma.schoolStudent.findMany({
      where: { organizationId, deletedAt: null },
      include: { guardians: { include: { guardian: { select: { id: true, firstName: true, lastName: true, relationship: true, phone: true, email: true } } } }, enrollments: { where: { organizationId, deletedAt: null, status: "ACTIVE" }, include: { academicYear: { select: { id: true, name: true } }, schoolClass: { select: { id: true, name: true, code: true } }, section: { select: { id: true, name: true } } }, take: 1 } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    const [subjects,teachers,teacherAssignments]=await Promise.all([
      prisma.schoolSubject.findMany({where:{organizationId,deletedAt:null},orderBy:{name:"asc"}}),
      prisma.schoolTeacher.findMany({where:{organizationId,deletedAt:null},orderBy:[{firstName:"asc"},{lastName:"asc"}]}),
      prisma.schoolTeacherAssignment.findMany({where:{organizationId,deletedAt:null},include:{teacher:{select:{id:true,employeeNumber:true,firstName:true,lastName:true}},subject:{select:{id:true,name:true,code:true}},academicYear:{select:{id:true,name:true}},schoolClass:{select:{id:true,name:true}},section:{select:{id:true,name:true}}},orderBy:{createdAt:"desc"}})
    ]);
    return { academicYears, students, subjects, teachers, teacherAssignments, metrics: { academicYears: academicYears.length, classes: academicYears.flatMap((item) => item.classes).length, sections: academicYears.flatMap((item) => item.classes.flatMap((schoolClass) => schoolClass.sections)).length, students: students.filter((item) => item.status === "ACTIVE").length, teachers:teachers.filter(item=>item.status==="ACTIVE").length, subjects:subjects.length } };
  }

  async createAcademicYear(organizationId: string, userId: string, input: AcademicYearInput) {
    return prisma.$transaction(async (tx) => {
      if (input.isCurrent) await tx.schoolAcademicYear.updateMany({ where: { organizationId, isCurrent: true, deletedAt: null }, data: { isCurrent: false, updatedById: userId } });
      return tx.schoolAcademicYear.create({ data: { ...input, organizationId, createdById: userId, updatedById: userId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async createClass(organizationId: string, userId: string, input: SchoolClassInput) {
    const year = await prisma.schoolAcademicYear.findFirst({ where: { id: input.academicYearId, organizationId, deletedAt: null }, select: { id: true } });
    if (!year) throw new AppError(404, "Academic year was not found.", "ACADEMIC_YEAR_NOT_FOUND");
    return prisma.schoolClass.create({ data: { ...input, organizationId, createdById: userId, updatedById: userId } });
  }

  async createSection(organizationId: string, userId: string, input: SchoolSectionInput) {
    const schoolClass = await prisma.schoolClass.findFirst({ where: { id: input.classId, organizationId, deletedAt: null, academicYear: { organizationId, deletedAt: null } }, select: { id: true } });
    if (!schoolClass) throw new AppError(404, "Class was not found.", "SCHOOL_CLASS_NOT_FOUND");
    return prisma.schoolSection.create({ data: { ...input, capacity: input.capacity ?? null, organizationId, createdById: userId, updatedById: userId } });
  }

  async createStudent(organizationId: string, userId: string, input: SchoolStudentInput) {
    try {
      return await prisma.$transaction(async (tx) => {
      const section = await tx.schoolSection.findFirst({ where: { id: input.sectionId, organizationId, deletedAt: null, schoolClass: { id: input.classId, organizationId, academicYearId: input.academicYearId, deletedAt: null, academicYear: { organizationId, deletedAt: null } } }, select: { id: true, capacity: true, _count: { select: { enrollments: { where: { organizationId, status: "ACTIVE", deletedAt: null } } } } } });
      if (!section) throw new AppError(404, "The selected academic placement was not found.", "SCHOOL_PLACEMENT_NOT_FOUND");
      if (section.capacity && section._count.enrollments >= section.capacity) throw new AppError(409, "The selected section has reached its capacity.", "SCHOOL_SECTION_FULL");
      const studentNumber = `STU-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
      const student = await tx.schoolStudent.create({ data: { organizationId, studentNumber, firstName: input.firstName, lastName: input.lastName, dateOfBirth: input.dateOfBirth, gender: input.gender, admissionDate: input.admissionDate, createdById: userId, updatedById: userId } });
      const guardian = await tx.schoolGuardian.create({ data: { organizationId, firstName: input.guardian.firstName, lastName: input.guardian.lastName, relationship: input.guardian.relationship, phone: input.guardian.phone, email: input.guardian.email, address: input.guardian.address, createdById: userId, updatedById: userId } });
      await tx.schoolStudentGuardian.create({ data: { organizationId, studentId: student.id, guardianId: guardian.id, isPrimary: true, canPickup: input.guardian.canPickup } });
      await tx.schoolEnrollment.create({ data: { organizationId, studentId: student.id, academicYearId: input.academicYearId, classId: input.classId, sectionId: input.sectionId, rollNumber: input.rollNumber, joinedOn: input.admissionDate, createdById: userId, updatedById: userId } });
      return student;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError(409, "That roll number is already assigned in the selected section. Use a different roll number.", "SCHOOL_ROLL_NUMBER_EXISTS", { rollNumber: "Roll numbers must be unique within a section." });
      }
      throw error;
    }
  }

  async updateStudent(organizationId: string, userId: string, id: string, input: SchoolStudentUpdateInput) {
    const updated = await prisma.schoolStudent.updateMany({ where: { id, organizationId, deletedAt: null }, data: { ...input, dateOfBirth: input.dateOfBirth ?? null, updatedById: userId } });
    if (!updated.count) throw new AppError(404, "Student was not found.", "SCHOOL_STUDENT_NOT_FOUND");
    return prisma.schoolStudent.findFirstOrThrow({ where: { id, organizationId, deletedAt: null } });
  }

  async archiveStudent(organizationId: string, userId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const student = await tx.schoolStudent.findFirst({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
      if (!student) throw new AppError(404, "Student was not found.", "SCHOOL_STUDENT_NOT_FOUND");
      const now = new Date();
      await tx.schoolEnrollment.updateMany({ where: { studentId: id, organizationId, status: "ACTIVE", deletedAt: null }, data: { status: "WITHDRAWN", deletedAt: now, updatedById: userId } });
      return tx.schoolStudent.update({ where: { id }, data: { status: "INACTIVE", deletedAt: now, updatedById: userId } });
    });
  }

  async createSubject(organizationId:string,userId:string,input:SchoolSubjectInput){return prisma.schoolSubject.create({data:{...input,organizationId,createdById:userId,updatedById:userId}})}
  async createTeacher(organizationId:string,userId:string,input:SchoolTeacherInput){const employeeNumber=`TCH-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0,4).toUpperCase()}`;return prisma.schoolTeacher.create({data:{...input,organizationId,employeeNumber,createdById:userId,updatedById:userId}})}
  async assignTeacher(organizationId:string,userId:string,input:SchoolTeacherAssignmentInput){
    const [teacher,subject,section]=await Promise.all([
      prisma.schoolTeacher.findFirst({where:{id:input.teacherId,organizationId,status:"ACTIVE",deletedAt:null},select:{id:true}}),
      prisma.schoolSubject.findFirst({where:{id:input.subjectId,organizationId,deletedAt:null},select:{id:true}}),
      prisma.schoolSection.findFirst({where:{id:input.sectionId,organizationId,deletedAt:null,schoolClass:{id:input.classId,organizationId,academicYearId:input.academicYearId,deletedAt:null}},select:{id:true}})
    ]);
    if(!teacher||!subject||!section)throw new AppError(404,"Teacher, subject, or academic placement was not found.","SCHOOL_ASSIGNMENT_CONTEXT_NOT_FOUND");
    if(input.isClassTeacher){const existing=await prisma.schoolTeacherAssignment.findFirst({where:{organizationId,academicYearId:input.academicYearId,classId:input.classId,sectionId:input.sectionId,isClassTeacher:true,deletedAt:null},select:{id:true}});if(existing)throw new AppError(409,"This section already has a class teacher.","SCHOOL_CLASS_TEACHER_EXISTS")}
    try{return await prisma.schoolTeacherAssignment.create({data:{...input,organizationId,createdById:userId,updatedById:userId}})}catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002")throw new AppError(409,"This teacher assignment already exists.","SCHOOL_TEACHER_ASSIGNMENT_EXISTS");throw error}
  }
  async attendance(organizationId:string,dateValue:string){const attendanceDate=new Date(`${dateValue}T00:00:00.000Z`),monthStart=new Date(Date.UTC(attendanceDate.getUTCFullYear(),attendanceDate.getUTCMonth(),1)),monthEnd=new Date(Date.UTC(attendanceDate.getUTCFullYear(),attendanceDate.getUTCMonth()+1,1));const[enrollments,teachers,studentRecords,teacherRecords,monthlyStudentSummary]=await Promise.all([prisma.schoolEnrollment.findMany({where:{organizationId,status:"ACTIVE",deletedAt:null},include:{student:{select:{id:true,studentNumber:true,firstName:true,lastName:true}},schoolClass:{select:{id:true,name:true}},section:{select:{id:true,name:true}}},orderBy:[{schoolClass:{sortOrder:"asc"}},{section:{name:"asc"}},{student:{firstName:"asc"}}]}),prisma.schoolTeacher.findMany({where:{organizationId,status:{in:["ACTIVE","ON_LEAVE"]},deletedAt:null},orderBy:{firstName:"asc"}}),prisma.schoolStudentAttendance.findMany({where:{organizationId,attendanceDate}}),prisma.schoolTeacherAttendance.findMany({where:{organizationId,attendanceDate}}),prisma.schoolStudentAttendance.groupBy({by:["studentId","status"],where:{organizationId,attendanceDate:{gte:monthStart,lt:monthEnd}},_count:{_all:true}})]);return{date:dateValue,enrollments,teachers,studentRecords,teacherRecords,monthlyStudentSummary}}
  async saveStudentAttendance(organizationId:string,userId:string,input:StudentAttendanceInput){
    const attendanceDate=new Date(`${input.date}T00:00:00.000Z`);
    const saved=await prisma.$transaction(async tx=>{const valid=await tx.schoolEnrollment.findMany({where:{organizationId,id:{in:input.records.map(item=>item.enrollmentId)},status:"ACTIVE",deletedAt:null},select:{id:true,studentId:true}});if(valid.length!==new Set(input.records.map(item=>item.enrollmentId)).size)throw new AppError(404,"One or more active student enrollments were not found.","SCHOOL_ENROLLMENT_NOT_FOUND");const studentByEnrollment=new Map(valid.map(item=>[item.id,item.studentId]));for(const record of input.records){const existing=await tx.schoolStudentAttendance.findUnique({where:{enrollmentId_attendanceDate:{enrollmentId:record.enrollmentId,attendanceDate}}});const attendance=await tx.schoolStudentAttendance.upsert({where:{enrollmentId_attendanceDate:{enrollmentId:record.enrollmentId,attendanceDate}},update:{status:record.status,remarks:record.remarks,updatedById:userId},create:{organizationId,studentId:studentByEnrollment.get(record.enrollmentId)!,enrollmentId:record.enrollmentId,attendanceDate,status:record.status,remarks:record.remarks,markedById:userId,updatedById:userId}});if(existing&&existing.status!==record.status)await tx.auditEvent.create({data:{organizationId,actorType:"USER",actorUserId:userId,serviceCode:"SCHOOL",actionCode:"STUDENT_ATTENDANCE_CORRECTED",sourceType:"SCHOOL_STUDENT_ATTENDANCE",sourceId:attendance.id,summary:"Student attendance status corrected.",beforeState:{status:existing.status},afterState:{status:record.status}}})}const presentStudentIds=input.records.filter(item=>item.status!=="ABSENT").map(item=>studentByEnrollment.get(item.enrollmentId)!).filter(Boolean);if(presentStudentIds.length)await tx.schoolGuardianAlert.updateMany({where:{organizationId,studentId:{in:presentStudentIds},attendanceDate,status:"PENDING_APPROVAL"},data:{status:"CANCELED",failureMessage:"Attendance was corrected before approval.",updatedById:userId}});return{saved:input.records.length,date:input.date,studentByEnrollment:Object.fromEntries(studentByEnrollment)}},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:10_000,timeout:60_000});
    const absentStudentIds=input.records.filter(item=>item.status==="ABSENT").map(item=>saved.studentByEnrollment[item.enrollmentId]).filter((value):value is string=>Boolean(value));
    const automation=absentStudentIds.length?await this.requestGuardianAlertApproval(organizationId,userId,input.date,absentStudentIds):null;
    return{saved:saved.saved,date:saved.date,automation};
  }

  private async requestGuardianAlertApproval(organizationId:string,userId:string,date:string,studentIds:string[]){
    const students=await prisma.schoolStudent.findMany({where:{organizationId,id:{in:studentIds},status:"ACTIVE",deletedAt:null},select:{id:true,firstName:true,lastName:true,guardians:{where:{organizationId},orderBy:{isPrimary:"desc"},take:1,select:{guardian:{select:{id:true,firstName:true,phone:true,email:true,deletedAt:true}}}}}});
    const contactable=students.filter(item=>item.guardians[0]?.guardian&&!item.guardians[0].guardian.deletedAt);
    if(!contactable.length)return{matched:false,reason:"NO_CONTACTABLE_GUARDIANS"};
    const result=await this.policyEngine.evaluate(organizationId,userId,{eventCode:"SCHOOL.STUDENT_ABSENT",sourceType:"SCHOOL_STUDENT_ATTENDANCE",sourceId:null,dedupeKey:`student-absence-alerts:${date}`,payload:{date,absentStudentCount:studentIds.length,contactableGuardianCount:contactable.length}},{simulation:false,forceApproval:true,actionCodes:["PREPARE_GUARDIAN_ABSENCE_ALERTS"]});
    if(!result.matched||!result.execution)return{matched:false,reason:"NO_ACTIVE_POLICY"};
    if(result.duplicate)return{matched:true,duplicate:true,executionId:result.execution.id};
    const policy=await prisma.automationPolicy.findFirst({where:{id:result.execution.policyId,organizationId},select:{actionConfig:true}}),config=(policy?.actionConfig??{}) as {channel?:string;schoolName?:string},preferredChannel=config.channel==="EMAIL"?"EMAIL":"WHATSAPP";
    const draftIds:string[]=[];
    await prisma.$transaction(async tx=>{for(const student of contactable){const guardian=student.guardians[0]!.guardian,channel=preferredChannel==="EMAIL"&&guardian.email?"EMAIL":"WHATSAPP",recipient=channel==="EMAIL"?guardian.email!:guardian.phone,studentName=`${student.firstName} ${student.lastName??""}`.trim(),body=`Dear ${guardian.firstName}, ${studentName} was marked absent on ${date}. Please contact the school if this attendance record needs correction. This is a prepared notification and will only be delivered after approval.`;const draft=await tx.schoolGuardianAlert.upsert({where:{organizationId_studentId_guardianId_attendanceDate_channel:{organizationId,studentId:student.id,guardianId:guardian.id,attendanceDate:new Date(`${date}T00:00:00.000Z`),channel}},update:{recipient,subject:"Student absence notification",body,status:"PENDING_APPROVAL",policyExecutionId:result.execution!.id,failureMessage:null,updatedById:userId},create:{organizationId,studentId:student.id,guardianId:guardian.id,attendanceDate:new Date(`${date}T00:00:00.000Z`),channel,recipient,subject:"Student absence notification",body,status:"PENDING_APPROVAL",policyExecutionId:result.execution!.id,createdById:userId,updatedById:userId}});draftIds.push(draft.id)}
      await tx.automationPolicyExecution.update({where:{id:result.execution!.id},data:{status:"AWAITING_APPROVAL",output:{date,draftIds,draftCount:draftIds.length,deliveryPerformed:false}}});
      await tx.approvalRequest.create({data:{organizationId,serviceCode:"SCHOOL",actionCode:"APPROVE_GUARDIAN_ABSENCE_ALERTS",title:`Approve guardian absence alerts for ${date}`,description:`B² Brain prepared ${draftIds.length} guardian notification draft${draftIds.length===1?"":"s"}. Approval marks them ready for delivery; it does not report them as sent.`,riskLevel:"MEDIUM",sourceType:"SCHOOL_GUARDIAN_ALERT_BATCH",sourceId:result.execution!.id,requestedById:userId,dueAt:new Date(Date.now()+2*60*60*1000),context:{date,draftIds}}});
      const owner=await tx.organizationMembership.findFirst({where:{organizationId,status:"ACTIVE",role:{code:"ORGANIZATION_OWNER"},user:{status:"ACTIVE",deletedAt:null}},select:{userId:true}});if(owner)await tx.notification.create({data:{organizationId,recipientId:owner.userId,type:"APPROVAL_REQUIRED",title:`Guardian absence alerts ready for ${date}`,message:`Review ${draftIds.length} notification draft${draftIds.length===1?"":"s"} before delivery.`,sourceType:"SCHOOL_GUARDIAN_ALERT_BATCH",sourceId:result.execution!.id,actionPath:"/dashboard?view=governance",createdById:userId,updatedById:userId}})
    });
    return{matched:true,duplicate:false,executionId:result.execution.id,approvalRequired:true,draftCount:draftIds.length};
  }

  async guardianAlerts(organizationId:string,dateValue?:string){return prisma.schoolGuardianAlert.findMany({where:{organizationId,...(dateValue?{attendanceDate:new Date(`${dateValue}T00:00:00.000Z`)}:{})},include:{student:{select:{id:true,studentNumber:true,firstName:true,lastName:true}},guardian:{select:{id:true,firstName:true,lastName:true,relationship:true}}},orderBy:{createdAt:"desc"},take:200})}
  async saveTeacherAttendance(organizationId:string,userId:string,input:TeacherAttendanceInput){
    const attendanceDate=new Date(`${input.date}T00:00:00.000Z`),ids=[...new Set(input.records.map(item=>item.teacherId))];
    const saved=await prisma.$transaction(async tx=>{const count=await tx.schoolTeacher.count({where:{organizationId,id:{in:ids},deletedAt:null}});if(count!==ids.length)throw new AppError(404,"One or more teachers were not found.","SCHOOL_TEACHER_NOT_FOUND");for(const record of input.records)await tx.schoolTeacherAttendance.upsert({where:{teacherId_attendanceDate:{teacherId:record.teacherId,attendanceDate}},update:{status:record.status,checkInAt:record.checkInAt?new Date(record.checkInAt):null,checkOutAt:record.checkOutAt?new Date(record.checkOutAt):null,remarks:record.remarks,updatedById:userId},create:{organizationId,teacherId:record.teacherId,attendanceDate,status:record.status,checkInAt:record.checkInAt?new Date(record.checkInAt):null,checkOutAt:record.checkOutAt?new Date(record.checkOutAt):null,remarks:record.remarks,markedById:userId,updatedById:userId}});return{saved:input.records.length,date:input.date}},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:10_000,timeout:60_000});
    const absentTeacherIds=input.records.filter(item=>["ABSENT","LEAVE"].includes(item.status)).map(item=>item.teacherId);
    const automation=absentTeacherIds.length?await this.requestCoverageApproval(organizationId,userId,input.date,absentTeacherIds):null;
    return{...saved,automation};
  }

  private async requestCoverageApproval(organizationId:string,userId:string,date:string,absentTeacherIds:string[]){
    const coverage=await this.substituteNeeds(organizationId,date);
    const uncovered=coverage.needs.filter(item=>!item.entry.substitutes[0]);
    if(!uncovered.length)return{matched:false,reason:"NO_UNCOVERED_PERIODS"};
    const reserved:{teacherId:string;startsAt:string;endsAt:string}[]=[],assignments:{timetableEntryId:string;substituteTeacherId:string;absentTeacherId:string}[]=[];
    for(const item of [...uncovered].sort((a,b)=>a.entry.startsAt.localeCompare(b.entry.startsAt))){const teacher=item.suggestions.find(candidate=>!reserved.some(slot=>slot.teacherId===candidate.id&&slot.startsAt<item.entry.endsAt&&slot.endsAt>item.entry.startsAt));if(!teacher)continue;assignments.push({timetableEntryId:item.entry.id,substituteTeacherId:teacher.id,absentTeacherId:item.entry.teacher.id});reserved.push({teacherId:teacher.id,startsAt:item.entry.startsAt,endsAt:item.entry.endsAt})}
    if(!assignments.length)return{matched:false,reason:"NO_AVAILABLE_SUBSTITUTES"};
    const result=await this.policyEngine.evaluate(organizationId,userId,{eventCode:"SCHOOL.TEACHER_ABSENT",sourceType:"SCHOOL_TEACHER_ATTENDANCE",sourceId:null,dedupeKey:`school-coverage:${date}`,payload:{date,absentTeacherCount:absentTeacherIds.length,uncoveredPeriodCount:uncovered.length}},{simulation:false,forceApproval:true,actionCodes:["GENERATE_SCHOOL_COVERAGE_PLAN"]});
    if(!result.matched||!result.execution)return{matched:false,reason:"NO_ACTIVE_POLICY"};
    if(result.duplicate)return{matched:true,duplicate:true,executionId:result.execution.id};
    const owner=await prisma.organizationMembership.findFirst({where:{organizationId,status:"ACTIVE",role:{code:"ORGANIZATION_OWNER"},user:{status:"ACTIVE",deletedAt:null}},select:{userId:true}});
    await prisma.$transaction(async tx=>{
      await tx.automationPolicyExecution.update({where:{id:result.execution!.id},data:{status:"AWAITING_APPROVAL",output:{date,assignments,proposedCount:assignments.length,uncoveredCount:uncovered.length-assignments.length}}});
      await tx.approvalRequest.create({data:{organizationId,serviceCode:"SCHOOL",actionCode:"APPLY_SCHOOL_COVERAGE_PLAN",title:`Approve substitute plan for ${date}`,description:`B² Brain prepared ${assignments.length} substitute assignment${assignments.length===1?"":"s"} after ${absentTeacherIds.length} teacher absence${absentTeacherIds.length===1?" was":"s were"} recorded.`,riskLevel:"MEDIUM",sourceType:"AUTOMATION_POLICY_EXECUTION",sourceId:result.execution!.id,requestedById:userId,dueAt:new Date(Date.now()+4*60*60*1000),context:{date,assignments}}});
      if(owner)await tx.notification.create({data:{organizationId,recipientId:owner.userId,type:"APPROVAL_REQUIRED",title:`Substitute plan ready for ${date}`,message:`Review ${assignments.length} proposed substitute assignment${assignments.length===1?"":"s"} before the timetable changes.`,sourceType:"AUTOMATION_POLICY_EXECUTION",sourceId:result.execution!.id,actionPath:"/dashboard?view=governance",createdById:userId,updatedById:userId}});
    });
    return{matched:true,duplicate:false,executionId:result.execution.id,approvalRequired:true,proposedAssignments:assignments.length};
  }

  async timetable(organizationId:string,filters:{academicYearId?:string|undefined;sectionId?:string|undefined;teacherId?:string|undefined}) {
    const [entries, assignments] = await Promise.all([
      prisma.schoolTimetableEntry.findMany({ where: { organizationId, deletedAt: null, ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}), ...(filters.sectionId ? { sectionId: filters.sectionId } : {}), ...(filters.teacherId ? { teacherId: filters.teacherId } : {}) }, include: { academicYear: { select: { id:true,name:true } }, schoolClass: { select: { id:true,name:true } }, section: { select: { id:true,name:true,room:true } }, subject: { select: { id:true,name:true,code:true } }, teacher: { select: { id:true,employeeNumber:true,firstName:true,lastName:true,maxPeriodsPerDay:true,maxPeriodsPerWeek:true } } }, orderBy: [{ dayOfWeek:"asc" },{ periodNumber:"asc" }] }),
      prisma.schoolTeacherAssignment.findMany({ where: { organizationId, deletedAt:null, teacher:{status:"ACTIVE",deletedAt:null}, academicYear:{deletedAt:null}, schoolClass:{deletedAt:null}, section:{deletedAt:null}, subject:{deletedAt:null} }, include:{teacher:{select:{id:true,firstName:true,lastName:true}},subject:{select:{id:true,name:true}},academicYear:{select:{id:true,name:true}},schoolClass:{select:{id:true,name:true}},section:{select:{id:true,name:true,room:true}}},orderBy:{createdAt:"asc"} })
    ]);
    return { entries, assignments };
  }

  async dailyTimetable(organizationId:string,dateValue:string) {
    const attendanceDate=new Date(`${dateValue}T00:00:00.000Z`),dayOfWeek=attendanceDate.getUTCDay();
    if(dayOfWeek===0)return{date:dateValue,dayOfWeek,entries:[],metrics:{total:0,normal:0,replaced:0,uncovered:0}};
    const entries=await prisma.schoolTimetableEntry.findMany({where:{organizationId,dayOfWeek,deletedAt:null},include:{academicYear:{select:{id:true,name:true}},schoolClass:{select:{id:true,name:true}},section:{select:{id:true,name:true,room:true}},subject:{select:{id:true,name:true,code:true}},teacher:{select:{id:true,employeeNumber:true,firstName:true,lastName:true}},substitutes:{where:{attendanceDate,status:"ASSIGNED"},select:{id:true,status:true,createdAt:true,substituteTeacher:{select:{id:true,employeeNumber:true,firstName:true,lastName:true}},createdBy:{select:{firstName:true,lastName:true}}}}},orderBy:[{periodNumber:"asc"},{startsAt:"asc"},{schoolClass:{sortOrder:"asc"}},{section:{name:"asc"}}]});
    const attendance=await prisma.schoolTeacherAttendance.findMany({where:{organizationId,attendanceDate,teacherId:{in:entries.map(item=>item.teacherId)}},select:{teacherId:true,status:true}}),attendanceMap=new Map(attendance.map(item=>[item.teacherId,item.status]));
    const rows=entries.map(entry=>{const teacherAttendance=attendanceMap.get(entry.teacherId)??"NOT_MARKED",substitute=entry.substitutes[0]??null,status=substitute?"REPLACED":["ABSENT","LEAVE"].includes(teacherAttendance)?"UNCOVERED":"NORMAL";return{...entry,teacherAttendance,substitute,status}}),metrics={total:rows.length,normal:rows.filter(item=>item.status==="NORMAL").length,replaced:rows.filter(item=>item.status==="REPLACED").length,uncovered:rows.filter(item=>item.status==="UNCOVERED").length};
    return{date:dateValue,dayOfWeek,entries:rows,metrics};
  }

  async createTimetableEntry(organizationId:string,userId:string,input:SchoolTimetableEntryInput) {
    return prisma.$transaction(async tx => {
      const assignment = await tx.schoolTeacherAssignment.findFirst({ where:{id:input.teacherAssignmentId,organizationId,deletedAt:null,teacher:{status:"ACTIVE",deletedAt:null},subject:{deletedAt:null},academicYear:{deletedAt:null},schoolClass:{deletedAt:null},section:{deletedAt:null}}, include:{teacher:{select:{id:true,maxPeriodsPerDay:true,maxPeriodsPerWeek:true}},section:{select:{room:true}}} });
      if(!assignment) throw new AppError(404,"The teaching assignment was not found.","SCHOOL_TEACHER_ASSIGNMENT_NOT_FOUND");
      const overlap = await tx.schoolTimetableEntry.findFirst({ where:{organizationId,academicYearId:assignment.academicYearId,dayOfWeek:input.dayOfWeek,deletedAt:null,startsAt:{lt:input.endsAt},endsAt:{gt:input.startsAt},OR:[{sectionId:assignment.sectionId},{teacherId:assignment.teacherId},...((input.room ?? assignment.section.room)?[{room:input.room ?? assignment.section.room}]:[])]},select:{sectionId:true,teacherId:true,room:true} });
      if(overlap) throw new AppError(409,"This time overlaps with an existing section, teacher, or room schedule.","SCHOOL_TIMETABLE_CONFLICT");
      const [dailyLoad,weeklyLoad]=await Promise.all([tx.schoolTimetableEntry.count({where:{organizationId,academicYearId:assignment.academicYearId,teacherId:assignment.teacherId,dayOfWeek:input.dayOfWeek,deletedAt:null}}),tx.schoolTimetableEntry.count({where:{organizationId,academicYearId:assignment.academicYearId,teacherId:assignment.teacherId,deletedAt:null}})]);
      if(dailyLoad>=assignment.teacher.maxPeriodsPerDay) throw new AppError(409,"This teacher has reached the daily period limit.","SCHOOL_TEACHER_DAILY_LIMIT");
      if(weeklyLoad>=assignment.teacher.maxPeriodsPerWeek) throw new AppError(409,"This teacher has reached the weekly period limit.","SCHOOL_TEACHER_WEEKLY_LIMIT");
      try{return await tx.schoolTimetableEntry.create({data:{organizationId,academicYearId:assignment.academicYearId,classId:assignment.classId,sectionId:assignment.sectionId,subjectId:assignment.subjectId,teacherId:assignment.teacherId,teacherAssignmentId:assignment.id,dayOfWeek:input.dayOfWeek,periodNumber:input.periodNumber,startsAt:input.startsAt,endsAt:input.endsAt,room:input.room ?? assignment.section.room,createdById:userId,updatedById:userId}})}catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002")throw new AppError(409,"That teacher or section already has this period.","SCHOOL_TIMETABLE_PERIOD_CONFLICT");throw error}
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async removeTimetableEntry(organizationId:string,_userId:string,id:string){return prisma.$transaction(async tx=>{const entry=await tx.schoolTimetableEntry.findFirst({where:{id,organizationId,deletedAt:null},select:{id:true}});if(!entry)throw new AppError(404,"Timetable entry was not found.","SCHOOL_TIMETABLE_ENTRY_NOT_FOUND");await tx.schoolSubstituteAssignment.deleteMany({where:{organizationId,timetableEntryId:id}});await tx.schoolTimetableEntry.delete({where:{id}});return{id}})}

  async substituteNeeds(organizationId:string,dateValue:string){const attendanceDate=new Date(`${dateValue}T00:00:00.000Z`),dayOfWeek=attendanceDate.getUTCDay();if(dayOfWeek===0)return{date:dateValue,needs:[]};const absent=await prisma.schoolTeacherAttendance.findMany({where:{organizationId,attendanceDate,status:{in:["ABSENT","LEAVE"]}},select:{teacherId:true}}),absentIds=absent.map(item=>item.teacherId);if(!absentIds.length)return{date:dateValue,needs:[]};const entries=await prisma.schoolTimetableEntry.findMany({where:{organizationId,teacherId:{in:absentIds},dayOfWeek,deletedAt:null},include:{teacher:{select:{id:true,firstName:true,lastName:true}},subject:{select:{id:true,name:true}},schoolClass:{select:{name:true}},section:{select:{name:true}},substitutes:{where:{attendanceDate},include:{substituteTeacher:{select:{id:true,firstName:true,lastName:true}}}}},orderBy:{periodNumber:"asc"}});const activeTeachers=await prisma.schoolTeacher.findMany({where:{organizationId,status:"ACTIVE",deletedAt:null,id:{notIn:absentIds}},select:{id:true,firstName:true,lastName:true,maxPeriodsPerDay:true}}),busy=await prisma.schoolTimetableEntry.findMany({where:{organizationId,dayOfWeek,deletedAt:null},select:{teacherId:true,startsAt:true,endsAt:true}}),existingSubstitutes=await prisma.schoolSubstituteAssignment.findMany({where:{organizationId,attendanceDate,status:"ASSIGNED"},select:{substituteTeacherId:true,timetableEntry:{select:{startsAt:true,endsAt:true}}}}),away=await prisma.schoolTeacherAttendance.findMany({where:{organizationId,attendanceDate,status:{in:["ABSENT","LEAVE"]}},select:{teacherId:true}}),awaySet=new Set(away.map(item=>item.teacherId));const qualifications=await prisma.schoolTeacherAssignment.findMany({where:{organizationId,teacherId:{in:activeTeachers.map(item=>item.id)},deletedAt:null},select:{teacherId:true,subjectId:true}});return{date:dateValue,needs:entries.map(entry=>({entry,suggestions:activeTeachers.filter(teacher=>!awaySet.has(teacher.id)&&!busy.some(slot=>slot.teacherId===teacher.id&&slot.startsAt<entry.endsAt&&slot.endsAt>entry.startsAt)&&!existingSubstitutes.some(slot=>slot.substituteTeacherId===teacher.id&&slot.timetableEntry.startsAt<entry.endsAt&&slot.timetableEntry.endsAt>entry.startsAt)).map(teacher=>({...teacher,subjectQualified:qualifications.some(item=>item.teacherId===teacher.id&&item.subjectId===entry.subjectId)})).sort((a,b)=>Number(b.subjectQualified)-Number(a.subjectQualified)).slice(0,8)}))}}

  async assignSubstitute(organizationId:string,userId:string,input:SchoolSubstituteInput){const attendanceDate=new Date(`${input.attendanceDate}T00:00:00.000Z`),dayOfWeek=attendanceDate.getUTCDay();return prisma.$transaction(async tx=>{const entry=await tx.schoolTimetableEntry.findFirst({where:{id:input.timetableEntryId,organizationId,dayOfWeek,deletedAt:null},select:{id:true,teacherId:true,startsAt:true,endsAt:true}}),teacher=await tx.schoolTeacher.findFirst({where:{id:input.substituteTeacherId,organizationId,status:"ACTIVE",deletedAt:null},select:{id:true}});if(!entry||!teacher)throw new AppError(404,"Timetable entry or substitute teacher was not found.","SCHOOL_SUBSTITUTE_CONTEXT_NOT_FOUND");if(entry.teacherId===teacher.id)throw new AppError(409,"The absent teacher cannot substitute their own period.","SCHOOL_SUBSTITUTE_INVALID");const unavailable=await tx.schoolTeacherAttendance.findFirst({where:{organizationId,teacherId:teacher.id,attendanceDate,status:{in:["ABSENT","LEAVE"]}},select:{id:true}}),scheduled=await tx.schoolTimetableEntry.findFirst({where:{organizationId,teacherId:teacher.id,dayOfWeek,deletedAt:null,startsAt:{lt:entry.endsAt},endsAt:{gt:entry.startsAt}},select:{id:true}}),substituteConflict=await tx.schoolSubstituteAssignment.findFirst({where:{organizationId,substituteTeacherId:teacher.id,attendanceDate,status:"ASSIGNED",timetableEntry:{startsAt:{lt:entry.endsAt},endsAt:{gt:entry.startsAt}}},select:{id:true}});if(unavailable||scheduled||substituteConflict)throw new AppError(409,"The selected substitute teacher is unavailable for this period.","SCHOOL_SUBSTITUTE_CONFLICT");return tx.schoolSubstituteAssignment.upsert({where:{timetableEntryId_attendanceDate:{timetableEntryId:entry.id,attendanceDate}},update:{substituteTeacherId:teacher.id,status:"ASSIGNED",notes:input.notes,updatedById:userId},create:{organizationId,timetableEntryId:entry.id,attendanceDate,absentTeacherId:entry.teacherId,substituteTeacherId:teacher.id,notes:input.notes,createdById:userId,updatedById:userId}})})}
}
