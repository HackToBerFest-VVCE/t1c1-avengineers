"""Application planning from extracted facts plus clearly identified general advice."""
from .schemas import ExtractedAnalysis, RoadmapTask, StudentProfile

MISSING_DEADLINE = "Deadline not found in the uploaded document. Verify it through the official scholarship provider."


def build_roadmap(analysis: ExtractedAnalysis, profile: StudentProfile) -> list[RoadmapTask]:
    tasks = [RoadmapTask(id="verify", title="Verify eligibility", title_kn="ಅರ್ಹತೆಯನ್ನು ಪರಿಶೀಲಿಸಿ",
                        detail_en="General advice: review every extracted requirement with the provider. This is not an official decision.",
                        detail_kn="ಸಾಮಾನ್ಯ ಸಲಹೆ: ಪ್ರತಿ ನಿಯಮವನ್ನು ಸಂಸ್ಥೆಯೊಂದಿಗೆ ಪರಿಶೀಲಿಸಿ. ಇದು ಅಧಿಕೃತ ನಿರ್ಣಯವಲ್ಲ.", priority="critical")]
    missing = [field for field, value in profile.model_dump().items() if value is None or value == "Not specified"]
    if missing or analysis.unknowns:
        tasks.append(RoadmapTask(id="missing", title="Resolve missing information", title_kn="ಬಾಕಿ ಮಾಹಿತಿಯನ್ನು ಪರಿಶೀಲಿಸಿ",
                                 detail_en="General advice: confirm missing profile fields (" + ", ".join(missing) + ") and the notice's unresolved details.",
                                 detail_kn="ಸಾಮಾನ್ಯ ಸಲಹೆ: ನೀಡದ ಪ್ರೊಫೈಲ್ ಮಾಹಿತಿ ಮತ್ತು ಪ್ರಕಟಣೆಯ ಅಸ್ಪಷ್ಟ ವಿವರಗಳನ್ನು ದೃಢಪಡಿಸಿ.", priority="critical"))
    for index, doc in enumerate(analysis.documents):
        tasks.append(RoadmapTask(id=f"document-{index}", title=doc.name, title_kn=doc.name_kn,
                                 detail_en="Prepare this document; verify format and validity with the provider.",
                                 detail_kn="ಈ ದಾಖಲೆಯನ್ನು ಸಿದ್ಧಪಡಿಸಿ; ಸಂಸ್ಥೆಯೊಂದಿಗೆ ನಮೂನೆ ಮತ್ತು ಮಾನ್ಯತೆಯನ್ನು ಪರಿಶೀಲಿಸಿ.",
                                 **doc.model_dump(include={"evidence", "page", "verification"})))
    tasks.append(RoadmapTask(id="deadline", title="Confirm application deadline", title_kn="ಅರ್ಜಿ ಗಡುವನ್ನು ದೃಢಪಡಿಸಿ",
                             detail_en=analysis.deadline.date_text or MISSING_DEADLINE,
                             detail_kn=analysis.deadline.date_text or "ಅಪ್‌ಲೋಡ್ ಮಾಡಿದ ದಾಖಲೆಯಲ್ಲಿ ಗಡುವು ಕಂಡುಬಂದಿಲ್ಲ. ಅಧಿಕೃತ ಸಂಸ್ಥೆಯೊಂದಿಗೆ ಪರಿಶೀಲಿಸಿ.",
                             priority="critical", **analysis.deadline.model_dump(include={"evidence", "page", "verification"})))
    for index, step in enumerate(analysis.steps):
        tasks.append(RoadmapTask(id=f"step-{index}", **step.model_dump()))
    tasks.append(RoadmapTask(id="final", title="Final review before submission", title_kn="ಸಲ್ಲಿಸುವ ಮೊದಲು ಅಂತಿಮ ಪರಿಶೀಲನೆ",
                             detail_en="General advice: verify the official submission method and retain acknowledgement. Checklist completion does not submit an application.",
                             detail_kn="ಸಾಮಾನ್ಯ ಸಲಹೆ: ಅಧಿಕೃತ ಸಲ್ಲಿಕೆ ವಿಧಾನವನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಸ್ವೀಕೃತಿಯನ್ನು ಉಳಿಸಿ. ಪಟ್ಟಿಯನ್ನು ಪೂರ್ಣಗೊಳಿಸುವುದು ಅರ್ಜಿ ಸಲ್ಲಿಕೆಯಲ್ಲ."))
    return tasks
