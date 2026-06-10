'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, Trophy, User } from 'lucide-react';
import { useAuth, SignInButton, UserButton } from '@clerk/nextjs';

const LINKS = [
  { href: '/', label: 'Inicio' },
  { href: '/complejos', label: 'Complejos' },
  { href: '/canchas', label: 'Canchas' },
  { href: '/contacto', label: 'Contacto' },
];

export default function Navbar() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [conSombra, setConSombra] = useState(false);
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    const manejarScroll = () => setConSombra(window.scrollY > 10);
    window.addEventListener('scroll', manejarScroll);
    return () => window.removeEventListener('scroll', manejarScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 bg-[#3B4F38] text-white transition-shadow duration-300 ${
        conSombra ? 'shadow-xl' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <Trophy className="w-5 h-5 text-[#ACC2AB]" />
            <span className="text-white">ComplejoSport</span>
          </Link>

          {/* Links desktop */}
          <div className="hidden md:flex items-center gap-8">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-[#ACC2AB] hover:text-white transition-colors duration-200"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth desktop */}
          <div className="hidden md:flex items-center gap-3 min-w-[120px] justify-end">
            {isLoaded && !isSignedIn && (
              <SignInButton mode="redirect">
                <button className="flex items-center gap-2 bg-[#ACC2AB] text-[#061F03] px-4 py-2 rounded-full text-sm font-semibold hover:bg-white transition-colors duration-200">
                  <User className="w-4 h-4" />
                  Iniciar sesión
                </button>
              </SignInButton>
            )}
            {isLoaded && isSignedIn && (
              <>
                <Link
                  href="/reservas"
                  className="text-sm font-medium text-[#ACC2AB] hover:text-white transition-colors duration-200"
                >
                  Mis reservas
                </Link>
                <UserButton
                  appearance={{
                    elements: { avatarBox: 'w-9 h-9' },
                  }}
                />
              </>
            )}
          </div>

          {/* Botón hamburguesa mobile */}
          <button
            onClick={() => setMenuAbierto(!menuAbierto)}
            className="md:hidden p-2 rounded text-[#ACC2AB] hover:text-white transition-colors"
            aria-label="Abrir menú"
          >
            {menuAbierto ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Menú desplegable mobile */}
      {menuAbierto && (
        <div className="md:hidden bg-[#3B4F38] border-t border-[#ACC2AB]/20 px-4 py-4 flex flex-col gap-4">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuAbierto(false)}
              className="text-[#ACC2AB] hover:text-white transition-colors text-sm font-medium"
            >
              {link.label}
            </Link>
          ))}
          {isLoaded && !isSignedIn && (
            <SignInButton mode="redirect">
              <button className="flex items-center gap-2 bg-[#ACC2AB] text-[#061F03] px-4 py-2 rounded-full text-sm font-semibold w-fit">
                <User className="w-4 h-4" />
                Iniciar sesión
              </button>
            </SignInButton>
          )}
          {isLoaded && isSignedIn && (
            <>
              <Link
                href="/reservas"
                onClick={() => setMenuAbierto(false)}
                className="text-[#ACC2AB] hover:text-white transition-colors text-sm font-medium"
              >
                Mis reservas
              </Link>
              <UserButton
                appearance={{
                  elements: { avatarBox: 'w-9 h-9' },
                }}
              />
            </>
          )}
        </div>
      )}
    </nav>
  );
}
