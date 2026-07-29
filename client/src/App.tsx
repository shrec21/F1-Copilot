import { useState } from 'react';
import { DisclaimerBanner } from './components/DisclaimerBanner';
import { StatusDashboard } from './components/StatusDashboard';
import { LogEmploymentForm } from './components/LogEmploymentForm';
import { ChatBox } from './components/ChatBox';
import { RulesTab } from './components/RulesTab';
import { ProfileSetupForm } from './components/ProfileSetupForm';
import { NewsPanel } from './components/NewsPanel';

type Tab = 'dashboard' | 'profile' | 'employment' | 'chat' | 'rules' | 'news';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'profile', label: 'Profile' },
  { id: 'employment', label: 'Log Employment' },
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
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
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
        {activeTab === 'dashboard' && <StatusDashboard />}
        {activeTab === 'profile' && (
          <ProfileSetupForm onFirstSave={() => setActiveTab('dashboard')} />
        )}
        {activeTab === 'employment' && <LogEmploymentForm />}
        {activeTab === 'chat' && <ChatBox />}
        {activeTab === 'rules' && <RulesTab />}
        {activeTab === 'news' && <NewsPanel />}
      </main>
    </div>
  );
}

export default App;
