// Compatibility layer: PCS pages were written against react-router-dom.
// This maps the small API surface they use (Link, useNavigate, useLocation,
// useParams) onto TanStack Router, so page code stays unchanged.
import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react";
import {
  Link as TsLink,
  useNavigate as useTsNavigate,
  useParams as useTsParams,
  useRouterState,
} from "@tanstack/react-router";

function splitTo(to: string) {
  const [path, query = ""] = to.split("?");
  const search = Object.fromEntries(new URLSearchParams(query));
  return { path: path || "/", search };
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
  children?: ReactNode;
};

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ to, ...rest }, ref) {
  const { path, search } = splitTo(to);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <TsLink ref={ref} to={path as any} search={search as any} {...(rest as any)} />;
});

export function useNavigate() {
  const navigate = useTsNavigate();
  return (to: string, opts?: { replace?: boolean }) => {
    const { path, search } = splitTo(to);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void navigate({ to: path as any, search: search as any, replace: opts?.replace });
  };
}

export function useLocation() {
  const loc = useRouterState({ select: (s) => s.location });
  return { pathname: loc.pathname, search: loc.searchStr, hash: loc.hash };
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (useTsParams as any)({ strict: false }) as T;
}
