import { useState } from 'react';
import { DisclaimerBanner } from './components/DisclaimerBanner';
import { StatusDashboard } from './components/StatusDashboard';
import { LogEmploymentForm } from './components/LogEmploymentForm';
import { ChatBox } from './components/ChatBox';
import { RulesTab } from './components/RulesTab';
import { ProfileSetupForm } from './components/ProfileSetupForm';
import { NewsPanel } from './components/NewsPanel';
import { AlertsBanner } from './components/AlertsBanner';
import { DeadlineCountdown } from './components/DeadlineCountdown';
import { SimulatorTab } from './components/SimulatorTab';
import { DsoEmailTab } from './components/DsoEmailTab';
import { TimelineTab } from './components/TimelineTab';
import { ActionPlanTab } from './components/ActionPlanTab';
import { DocumentChecklist } from './components/DocumentChecklist';
import { ScenarioExplainer } from './components/ScenarioExplainer';
import { FilingCalculator } from './components/FilingCalculator';
import { RiskModel } from './components/RiskModel';
import { CohortTab } from './components/CohortTab';
import { RegulationWatcherTab } from './components/RegulationWatcherTab';

type Tab = 'dashboard' | 'profile' | 'employment' | 'chat' | 'rules' | 'news' | 'simulator' | 'dso-email' | 'timeline' | 'action-plan' | 'documents' | 'scenarios' | 'filing' | 'risk' | 'cohort' | 'regulation';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'profile', label: 'Profile' },
  { id: 'employment', label: 'Log Employment' },
  { id: 'action-plan', label: 'Action Plan' },
  { id: 'documents', label: 'Documents' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'filing', label: 'Filing Windows' },
  { id: 'risk', label: 'Risk Model' },
  { id: 'simulator', label: 'Simulator' },
  { id: 'dso-email', label: 'DSO Email' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'cohort', label: 'Cohort' },
  { id: 'regulation', label: 'Reg Watcher' },
  { id: 'chat', label: 'Chat' },
  { id: 'rules', label: 'Rules' },
  { id: 'news', label: 'News' },
];

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Always-visible disclaimer banner */}
      <DisclaimerBanner />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">F-1 Compliance Copilot</h1>
        <p className="text-xs text-gray-500">
          Compliance information tool — not legal advice
        </p>
      </header>

      {/* Tab navigation */}
      <nav className="bg-white border-b border-gray-200 px-4">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Tab content */}
      <main className="flex-1 px-4 py-6 max-w-3xl w-full mx-auto">
        {activeTab === 'dashboard' && (
          <>
            <AlertsBanner />
            <DeadlineCountdown />
            <StatusDashboard />
          </>
        )}
        {activeTab === 'profile' && (
          <ProfileSetupForm onFirstSave={() => setActiveTab('dashboard')} />
        )}
        {activeTab === 'employment' && <LogEmploymentForm />}
        {activeTab === 'action-plan' && <ActionPlanTab />}
        {activeTab === 'documents' && <DocumentChecklist />}
        {activeTab === 'scenarios' && <ScenarioExplainer />}
        {activeTab === 'filing' && <FilingCalculator />}
        {activeTab === 'risk' && <RiskModel />}
        {activeTab === 'simulator' && <SimulatorTab />}
        {activeTab === 'dso-email' && <DsoEmailTab />}
        {activeTab === 'timeline' && <TimelineTab />}
        {activeTab === 'cohort' && <CohortTab />}
        {activeTab === 'regulation' && <RegulationWatcherTab />}
        {activeTab === 'chat' && <ChatBox />}
        {activeTab === 'rules' && <RulesTab />}
        {activeTab === 'news' && <NewsPanel />}
      </main>
    </div>
  );
}

export default App;
