import { useState, useEffect } from 'react';
import { Header } from './components/Layout/Header';
import { Tabs } from './components/Layout/Tabs';
import { useDesignerStore } from './stores/designerStore';
import { useMoodboardStore } from './stores/moodboardStore';
import { DesignerGrid } from './components/Designers/DesignerGrid';
import { MoodboardGrid } from './components/Moodboard/MoodboardGrid';
import { MigrationOverview } from './components/Dashboard/MigrationOverview';

function App() {
  const [activeTab, setActiveTab] = useState('overview');

  const fetchDesigners = useDesignerStore(state => state.fetchDesigners);
  const fetchProducts = useMoodboardStore(state => state.fetchProducts);

  useEffect(() => {
    if (activeTab === 'designers') fetchDesigners();
    if (activeTab === 'moodboard') fetchProducts();
  }, [activeTab, fetchDesigners, fetchProducts]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased">
      <Header />
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'designers', label: 'Designers' },
          { value: 'moodboard', label: 'Moodboard' },
          { value: 'spotlight', label: 'Spotlight' },
        ]}
      />

      <main className="flex-1 overflow-hidden h-[calc(100vh-3.5rem-3rem)]">
        {activeTab === 'overview' && <MigrationOverview />}
        {activeTab === 'designers' && <DesignerGrid />}
        {activeTab === 'moodboard' && <MoodboardGrid />}
        {activeTab === 'spotlight' && (
          <div className="p-4 flex items-center justify-center h-64 text-muted-foreground">Coming Soon</div>
        )}
      </main>
    </div>
  );
}

export default App;
