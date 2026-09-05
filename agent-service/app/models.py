from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Text = Annotated[str, Field(min_length=1, max_length=500)]
RequestId = Annotated[
    str, Field(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)


class Fact(StrictModel):
    id: Annotated[str, Field(min_length=1, max_length=120)]
    label: Annotated[str, Field(min_length=1, max_length=200)]
    value: Annotated[str, Field(max_length=500)] | float | None
    period: Annotated[str, Field(max_length=120)]


Facts = Annotated[list[Fact], Field(max_length=40)]
Empty = Annotated[list[str], Field(max_length=0)]


class Constraints(StrictModel):
    evidenceOnly: Literal[True]
    noTools: Literal[True]
    maxOutputTokens: Annotated[int, Field(ge=200, le=2000)]

    @field_validator("evidenceOnly", "noTools", mode="before")
    @classmethod
    def literal_boolean(cls, value: object) -> object:
        if value is not True:
            raise ValueError("Must be boolean true")
        return value


class ReasonRequest(StrictModel):
    contractVersion: Literal["1"]
    requestId: RequestId
    message: Annotated[str, Field(min_length=1, max_length=4096)]
    languageHint: Literal["en", "hi", "hinglish"] | None
    shortConversationSummary: Annotated[str, Field(max_length=2000)]
    structuredBusinessFacts: Facts
    calculatedHealthResults: Facts
    calculatedFinancialResults: Facts
    calculatedForecastResults: Facts
    relevantProductHelp: Annotated[list[Text], Field(max_length=5)]
    allowedToolNames: Empty
    permissionSafeRecordReferences: Empty
    maximumToolIterations: Annotated[int, Field(ge=0, le=1)]
    responseConstraints: Constraints

    def facts(self) -> list[Fact]:
        return (
            self.structuredBusinessFacts
            + self.calculatedHealthResults
            + self.calculatedFinancialResults
            + self.calculatedForecastResults
        )


class Recommendation(StrictModel):
    action: Text
    reason: Text
    expectedImpact: Text


class ReasonOutput(StrictModel):
    answer: Annotated[str, Field(min_length=1, max_length=4000)]
    confidence: Literal["LOW", "MEDIUM", "HIGH"]
    evidenceReferences: Annotated[
        list[Annotated[str, Field(min_length=1, max_length=120)]], Field(max_length=20)
    ]
    conclusions: Annotated[list[Text], Field(max_length=8)]
    recommendations: Annotated[list[Recommendation], Field(max_length=8)]
    assumptions: Annotated[list[Text], Field(max_length=8)]
    missingInformation: Annotated[list[Text], Field(max_length=10)]
    proposedToolCalls: Empty
    requiresConfirmation: bool
    requiresHumanEscalation: bool
    escalationReason: Annotated[str, Field(max_length=500)] | None


class Usage(StrictModel):
    source: Literal["REAL_AI", "DETERMINISTIC_FALLBACK"]
    inputTokens: Annotated[int, Field(ge=0, le=100000)]
    outputTokens: Annotated[int, Field(ge=0, le=2000)]
    totalTokens: Annotated[int, Field(ge=0, le=102000)]


class ReasonResponse(ReasonOutput):
    contractVersion: Literal["1"]
    requestId: RequestId
    providerUsage: Usage
