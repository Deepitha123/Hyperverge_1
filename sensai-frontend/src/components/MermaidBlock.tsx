import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
});
// @ts-ignore
mermaid.parseError = () => {}; 

interface MermaidBlockProps {
    code: string;
}

export const MermaidBlock: React.FC<MermaidBlockProps> = ({ code }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!ref.current || !code) return;
        
        setError(null);
        const id = `mermaid-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        
        const renderDiagram = async () => {
            try {
                // Sanitize code string: remove any potential starting/ending markdown artifacts
                let cleanCode = code.trim();
                if (cleanCode.startsWith('mermaid')) {
                    cleanCode = cleanCode.substring('mermaid'.length).trim();
                }
                
                const { svg } = await mermaid.render(id, cleanCode);
                if (svg.includes('Syntax error in text')) {
                    throw new Error('Mermaid internally returned a syntax error SVG.');
                }
                
                if (ref.current) {
                    ref.current.innerHTML = svg;
                }
            } catch (err: any) {
                console.error('Mermaid rendering error:', err);
                setError(err?.message || 'Failed to render diagram');
            }
        };
        
        renderDiagram();
    }, [code]);

    if (error) {
        return (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200 overflow-x-auto text-sm font-mono">
                Failed to render diagram:
                <br />
                {error}
                <hr className="my-2 border-red-200" />
                <pre>{code}</pre>
            </div>
        );
    }

    return (
        <div 
            ref={ref} 
            className="mermaid-wrapper flex justify-center py-4 overflow-x-auto bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 my-4" 
        />
    );
};
