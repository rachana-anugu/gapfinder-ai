import AttemptReportPage from "./[attemptId]/page";

export default function ReportIndexPage() {
  // Provide empty attemptId so it defaults to the latest attempt or cumulative history
  return <AttemptReportPage params={Promise.resolve({ attemptId: undefined })} />;
}
